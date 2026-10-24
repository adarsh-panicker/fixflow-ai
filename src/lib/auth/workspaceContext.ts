// src/lib/auth/workspaceContext.ts
import { prisma } from '@/lib/db/prisma';
import { getSession } from './session';
import { assertPermission, AuthorizationError } from './rbac';
import { Permission, UserSession, WorkspaceRole } from '@/types/auth';

export class WorkspaceAccessDeniedError extends Error {
  statusCode: number;

  constructor(message: string = 'Workspace access denied or workspace not found', statusCode: number = 403) {
    super(message);
    this.name = 'WorkspaceAccessDeniedError';
    this.statusCode = statusCode;
  }
}

export interface AuthorizedWorkspaceContext {
  user: UserSession;
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
}

/**
 * Resolves the authenticated user and verifies active membership in the target workspace.
 * If permission is specified, verifies the role has the permission.
 * Throws AuthorizationError or WorkspaceAccessDeniedError on failure.
 */
export async function getAuthorizedWorkspaceContext(
  req?: Request,
  requiredPermission?: Permission,
  explicitWorkspaceId?: string
): Promise<AuthorizedWorkspaceContext> {
  const user = await getSession(req);
  if (!user) {
    throw new AuthorizationError('Authentication required: please log in', 401);
  }

  // Determine requested workspace ID
  let targetWorkspaceId = explicitWorkspaceId;

  if (!targetWorkspaceId && req) {
    // 1. Check custom header
    const headerWs = req.headers.get('x-workspace-id');
    if (headerWs) {
      targetWorkspaceId = headerWs;
    } else {
      // 2. Check query parameter if available
      try {
        const url = new URL(req.url);
        const queryWs = url.searchParams.get('workspaceId');
        if (queryWs) {
          targetWorkspaceId = queryWs;
        }
      } catch {
        // Ignored if req.url is relative
      }
    }
  }

  // 3. Fallback to active workspace in session
  if (!targetWorkspaceId) {
    targetWorkspaceId = user.activeWorkspaceId;
  }

  if (!targetWorkspaceId) {
    throw new WorkspaceAccessDeniedError('No active workspace specified', 400);
  }

  // Query database to verify active membership
  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: targetWorkspaceId,
        userId: user.userId,
      },
    },
    include: {
      workspace: true,
    },
  });

  if (!membership || !membership.workspace) {
    // Return 404 or 403 without leaking if workspace exists for other users
    throw new WorkspaceAccessDeniedError('Workspace not found or access denied', 404);
  }

  const role = membership.role as WorkspaceRole;

  // Enforce role-based permission if requested
  if (requiredPermission) {
    assertPermission(role, requiredPermission);
  }

  return {
    user: {
      ...user,
      activeWorkspaceId: targetWorkspaceId,
      activeRole: role,
    },
    workspaceId: targetWorkspaceId,
    workspaceName: membership.workspace.name,
    role,
  };
}

/**
 * Records an immutable workspace security audit event.
 */
export async function recordAuditEvent(
  workspaceId: string,
  actorEmail: string,
  eventType: string,
  options?: {
    actorId?: string;
    targetType?: string;
    targetId?: string;
    metadata?: any;
  }
): Promise<void> {
  try {
    await prisma.workspaceAuditEvent.create({
      data: {
        workspaceId,
        actorId: options?.actorId,
        actorEmail,
        eventType,
        targetType: options?.targetType,
        targetId: options?.targetId,
        metadata: options?.metadata ? JSON.stringify(options.metadata) : null,
      },
    });
  } catch (err) {
    console.error('Failed to record audit event:', err);
  }
}
