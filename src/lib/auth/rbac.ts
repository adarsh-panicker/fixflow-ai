// src/lib/auth/rbac.ts
import { WorkspaceRole, Permission } from '@/types/auth';

const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  OWNER: [
    'workspace:read',
    'workspace:update',
    'workspace:delete',
    'workspace:transfer',
    'members:read',
    'members:invite',
    'members:update_role',
    'members:remove',
    'assets:read',
    'assets:write',
    'assets:delete',
    'assets:import',
    'monitoring:read',
    'monitoring:manage',
    'monitoring:acknowledge',
    'incidents:read',
    'incidents:write',
    'incidents:diagnose',
    'incidents:resolve',
    'incidents:report',
    'knowledge:read',
    'knowledge:write',
    'knowledge:verify',
    'knowledge:archive',
    'audit:read',
  ],

  ADMIN: [
    'workspace:read',
    'workspace:update',
    'members:read',
    'members:invite',
    'members:update_role',
    'members:remove',
    'assets:read',
    'assets:write',
    'assets:delete',
    'assets:import',
    'monitoring:read',
    'monitoring:manage',
    'monitoring:acknowledge',
    'incidents:read',
    'incidents:write',
    'incidents:diagnose',
    'incidents:resolve',
    'incidents:report',
    'knowledge:read',
    'knowledge:write',
    'knowledge:verify',
    'knowledge:archive',
    'audit:read',
  ],

  SUPPORT: [
    'workspace:read',
    'members:read',
    'assets:read',
    'monitoring:read',
    'monitoring:acknowledge',
    'incidents:read',
    'incidents:write',
    'incidents:diagnose',
    'incidents:resolve',
    'incidents:report',
    'knowledge:read',
    'knowledge:write',
  ],

  VIEWER: [
    'workspace:read',
    'members:read',
    'assets:read',
    'monitoring:read',
    'incidents:read',
    'incidents:report',
    'knowledge:read',
  ],
};

export class AuthorizationError extends Error {
  statusCode: number;

  constructor(message: string = 'Forbidden: insufficient permissions', statusCode: number = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
  }
}

/**
 * Checks whether a given role is granted a specific permission.
 */
export function hasPermission(role: string | WorkspaceRole, permission: Permission): boolean {
  const normalizedRole = role.toUpperCase() as WorkspaceRole;
  const permissions = ROLE_PERMISSIONS[normalizedRole];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Asserts that the role has the required permission, throwing AuthorizationError if not.
 */
export function assertPermission(role: string | WorkspaceRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new AuthorizationError(
      `Access denied: role '${role}' does not hold permission '${permission}'`,
      403
    );
  }
}

/**
 * Checks if a member role can manage another member's role.
 * - OWNER can manage anyone (including transferring ownership or removing admins).
 * - ADMIN can manage SUPPORT and VIEWER, but CANNOT modify or remove an OWNER, nor promote someone to OWNER.
 * - SUPPORT and VIEWER cannot manage any roles.
 */
export function canManageRole(
  actorRole: WorkspaceRole,
  targetCurrentRole?: WorkspaceRole,
  targetNewRole?: WorkspaceRole
): boolean {
  if (actorRole === 'OWNER') {
    return true;
  }

  if (actorRole === 'ADMIN') {
    // Cannot alter an OWNER
    if (targetCurrentRole === 'OWNER') return false;
    // Cannot promote anyone to OWNER
    if (targetNewRole === 'OWNER') return false;
    return true;
  }

  return false;
}
