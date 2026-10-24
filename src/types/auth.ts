// src/types/auth.ts

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'SUPPORT' | 'VIEWER';

export type Permission =
  // Workspace management
  | 'workspace:read'
  | 'workspace:update'
  | 'workspace:delete'
  | 'workspace:transfer'
  // Membership & Invitations
  | 'members:read'
  | 'members:invite'
  | 'members:update_role'
  | 'members:remove'
  // Assets & Topology
  | 'assets:read'
  | 'assets:write'
  | 'assets:delete'
  | 'assets:import'
  // Monitoring & Agents
  | 'monitoring:read'
  | 'monitoring:manage'
  | 'monitoring:acknowledge'
  // Incidents & Troubleshooting
  | 'incidents:read'
  | 'incidents:write'
  | 'incidents:diagnose'
  | 'incidents:resolve'
  | 'incidents:report'
  // Knowledge Base
  | 'knowledge:read'
  | 'knowledge:write'
  | 'knowledge:verify'
  | 'knowledge:archive'
  // Audit Logs
  | 'audit:read';

export interface UserSession {
  userId: string;
  username?: string | null;
  email: string;
  name: string;
  activeWorkspaceId: string;
  activeRole: WorkspaceRole;
  avatarUrl?: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  description?: string | null;
  role: WorkspaceRole;
}

export interface WorkspaceMemberDTO {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
  avatarUrl?: string | null;
}

export interface WorkspaceInvitationDTO {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  invitedByName: string;
}

export interface WorkspaceAuditEventDTO {
  id: string;
  eventType: string;
  actorEmail: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: any;
  createdAt: string;
}
