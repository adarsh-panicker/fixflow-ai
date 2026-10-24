// src/app/members/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  XCircle,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/NotificationToast';
import { WorkspaceMemberDTO, WorkspaceInvitationDTO, WorkspaceRole } from '@/types/auth';

export default function MembersPage() {
  const [activeTab, setActiveTab] = useState<'members' | 'audit'>('members');
  const [members, setMembers] = useState<WorkspaceMemberDTO[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitationDTO[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<WorkspaceRole>('SUPPORT');

  // Invite Modal State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('SUPPORT');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Remove Member Confirm State
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMemberDTO | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Revoke Invitation Confirm State
  const [inviteToRevoke, setInviteToRevoke] = useState<WorkspaceInvitationDTO | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const { toast } = useToast();

  const canManage = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  const loadData = async () => {
    try {
      const res = await fetch('/api/workspace/members');
      const data = await res.json();
      if (data.success) {
        setMembers(data.members || []);
        setInvitations(data.invitations || []);
        if (data.currentUserRole) {
          setCurrentUserRole(data.currentUserRole);
        }
      }

      // If user is Admin or Owner, load audit logs
      try {
        const auditRes = await fetch('/api/workspace/audit-logs');
        const auditData = await auditRes.json();
        if (auditData.success) {
          setAuditLogs(auditData.logs || []);
        }
      } catch {
        // Audit logs restricted for non-admins
      }
    } catch (err: any) {
      console.error('Failed to load members:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsSubmittingInvite(true);
    try {
      const res = await fetch('/api/workspace/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to issue invitation');
      }

      setGeneratedInviteUrl(data.inviteUrl);
      toast({
        title: 'Invitation Generated',
        message: `Single-use invitation token created for ${inviteEmail}.`,
        type: 'success',
      });
      loadData();
    } catch (err: any) {
      toast({
        title: 'Invitation Error',
        message: err.message || 'Could not issue invitation.',
        type: 'error',
      });
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: WorkspaceRole) => {
    try {
      const res = await fetch(`/api/workspace/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update role');
      }

      toast({
        title: 'Role Updated',
        message: `Member role updated to ${newRole}.`,
        type: 'success',
      });
      loadData();
    } catch (err: any) {
      toast({
        title: 'Role Update Failed',
        message: err.message || 'Failed to update role.',
        type: 'error',
      });
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsRemoving(true);
    try {
      const res = await fetch(`/api/workspace/members/${memberToRemove.userId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove member');
      }

      toast({
        title: 'Member Removed',
        message: `${memberToRemove.name} has been removed from this workspace.`,
        type: 'info',
      });
      setMemberToRemove(null);
      loadData();
    } catch (err: any) {
      toast({
        title: 'Removal Error',
        message: err.message || 'Could not remove member.',
        type: 'error',
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const handleRevokeInvite = async () => {
    if (!inviteToRevoke) return;
    setIsRevoking(true);
    try {
      const res = await fetch(`/api/workspace/invitations/${inviteToRevoke.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to revoke invitation');
      }

      toast({
        title: 'Invitation Revoked',
        message: `Invitation for ${inviteToRevoke.email} has been revoked.`,
        type: 'info',
      });
      setInviteToRevoke(null);
      loadData();
    } catch (err: any) {
      toast({
        title: 'Revoke Error',
        message: err.message || 'Could not revoke invitation.',
        type: 'error',
      });
    } finally {
      setIsRevoking(false);
    }
  };

  const copyInviteUrl = () => {
    if (generatedInviteUrl) {
      const full = `${window.location.origin}${generatedInviteUrl}`;
      navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getRoleBadgeVariant = (role: WorkspaceRole) => {
    switch (role) {
      case 'OWNER':
        return 'rose';
      case 'ADMIN':
        return 'amber';
      case 'SUPPORT':
        return 'cyan';
      case 'VIEWER':
      default:
        return 'slate';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Workspace Members & Access Control
            </h1>
            <Badge variant="cyan" size="sm">
              Role: {currentUserRole}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage authorized operators, assign role-based permissions, and generate single-use invitations.
          </p>
        </div>

        {canManage && (
          <Button
            variant="cyan"
            size="sm"
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() => {
              setGeneratedInviteUrl(null);
              setInviteEmail('');
              setInviteRole('SUPPORT');
              setIsInviteOpen(true);
            }}
          >
            Invite Member
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'members'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Members & Invitations ({members.length})
        </button>

        {canManage && (
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'audit'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Security Audit Logs ({auditLogs.length})
          </button>
        )}
      </div>

      {activeTab === 'audit' ? (
        <Card className="border-slate-800 bg-slate-950/80">
          <CardHeader>
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Immutable Workspace Security Audit Stream ({auditLogs.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Cryptographic audit trail of authentication events, invitations, and role transitions
              </CardDescription>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                  <th className="py-2.5 px-4 font-medium">Timestamp</th>
                  <th className="py-2.5 px-4 font-medium">Event Type</th>
                  <th className="py-2.5 px-4 font-medium">Actor</th>
                  <th className="py-2.5 px-4 font-medium">Target</th>
                  <th className="py-2.5 px-4 font-medium">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No security audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-[10px]">
                          {log.eventType}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-300 font-medium">
                        {log.actorEmail}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                        {log.targetType || '—'} {log.targetId ? `(${log.targetId.slice(0, 10)})` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono text-[10px] truncate max-w-xs">
                        {log.metadata ? JSON.stringify(log.metadata) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <>
          {/* Role Permission Matrix Card */}
          <Card className="bg-slate-950/70 border-slate-800 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-400">Owner</span>
              <Badge variant="rose" size="sm">Full Authority</Badge>
            </div>
            <p className="text-[11px] text-slate-400">
              Workspace settings, transfer ownership, manage all roles, verify KB articles, and delete workspace.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400">Admin</span>
              <Badge variant="amber" size="sm">Operations Lead</Badge>
            </div>
            <p className="text-[11px] text-slate-400">
              Invite and manage Support/Viewer members, configure monitoring agents, verify articles.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-400">IT Support</span>
              <Badge variant="cyan" size="sm">Triage & Triage</Badge>
            </div>
            <p className="text-[11px] text-slate-400">
              Run guided/agent diagnostics, create incidents, apply KB solutions, generate reports.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300">Viewer</span>
              <Badge variant="slate" size="sm">Read-Only</Badge>
            </div>
            <p className="text-[11px] text-slate-400">
              Inspect CMDB assets, dependency maps, ICMP availability dashboards, and approved incident reports.
            </p>
          </div>
        </div>
      </Card>

      {/* Active Members Table */}
      <Card className="border-slate-800 bg-slate-950/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Active Members ({members.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Users with verified membership in this workspace
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                <th className="py-2.5 px-4 font-medium">Member</th>
                <th className="py-2.5 px-4 font-medium">Email</th>
                <th className="py-2.5 px-4 font-medium">Role</th>
                <th className="py-2.5 px-4 font-medium">Joined Date</th>
                {canManage && <th className="py-2.5 px-4 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] font-bold text-cyan-400">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{member.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">{member.email}</td>
                  <td className="py-3 px-4">
                    {canManage && member.role !== 'OWNER' && currentUserRole === 'OWNER' ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value as WorkspaceRole)}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="SUPPORT">SUPPORT</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    ) : (
                      <Badge variant={getRoleBadgeVariant(member.role)} size="sm">
                        {member.role}
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  {canManage && (
                    <td className="py-3 px-4 text-right">
                      {member.role !== 'OWNER' && (
                        <button
                          onClick={() => setMemberToRemove(member)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-900 transition-colors"
                          title="Remove from workspace"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pending Invitations Section */}
      {invitations.length > 0 && (
        <Card className="border-slate-800 bg-slate-950/80">
          <CardHeader>
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Pending Invitations ({invitations.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Single-use invitations waiting to be accepted by operators
              </CardDescription>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                  <th className="py-2.5 px-4 font-medium">Invited Email</th>
                  <th className="py-2.5 px-4 font-medium">Role</th>
                  <th className="py-2.5 px-4 font-medium">Invited By</th>
                  <th className="py-2.5 px-4 font-medium">Expires At</th>
                  {canManage && <th className="py-2.5 px-4 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-300">{inv.email}</td>
                    <td className="py-3 px-4">
                      <Badge variant={getRoleBadgeVariant(inv.role)} size="sm">
                        {inv.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{inv.invitedByName}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setInviteToRevoke(inv)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-900 transition-colors"
                          title="Revoke invitation"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </>
      )}

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite New Workspace Operator"
      >
        {generatedInviteUrl ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Single-Use Invitation Generated</span>
              </div>
              <p className="text-[11px] text-slate-400">
                FixFlow AI operates completely local-first with zero external email dependencies. Copy and provide this invitation link to the operator:
              </p>
              <div className="p-2.5 rounded bg-black/60 border border-slate-800 font-mono text-[11px] text-cyan-300 break-all select-all">
                {`${typeof window !== 'undefined' ? window.location.origin : ''}${generatedInviteUrl}`}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="cyan"
                size="sm"
                onClick={copyInviteUrl}
                leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copied ? 'Copied to Clipboard' : 'Copy Invitation Link'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInviteOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateInvite} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Operator Email Address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="e.g. operator@company.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Assigned Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {currentUserRole === 'OWNER' && <option value="ADMIN">ADMIN — Can invite and manage members</option>}
                <option value="SUPPORT">SUPPORT — Can run diagnostics and resolve incidents</option>
                <option value="VIEWER">VIEWER — Read-only access to assets & telemetry</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsInviteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="cyan"
                size="sm"
                isLoading={isSubmittingInvite}
                leftIcon={<UserPlus className="w-3.5 h-3.5" />}
              >
                Generate Invitation
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirm Member Removal Dialog */}
      <ConfirmDialog
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleRemoveMember}
        title="Remove Member from Workspace?"
        message={`Are you sure you want to remove ${memberToRemove?.name} (${memberToRemove?.email})? They will immediately lose access to this workspace's assets and incidents.`}
        confirmLabel="Remove Member"
        variant="danger"
        isLoading={isRemoving}
      />

      {/* Confirm Revoke Invite Dialog */}
      <ConfirmDialog
        isOpen={!!inviteToRevoke}
        onClose={() => setInviteToRevoke(null)}
        onConfirm={handleRevokeInvite}
        title="Revoke Pending Invitation?"
        message={`Are you sure you want to revoke the invitation for ${inviteToRevoke?.email}? The generated link will become permanently invalid.`}
        confirmLabel="Revoke Invitation"
        variant="danger"
        isLoading={isRevoking}
      />
    </div>
  );
}
