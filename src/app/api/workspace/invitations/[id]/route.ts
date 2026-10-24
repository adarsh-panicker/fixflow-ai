// src/app/api/workspace/invitations/[id]/route.ts
import { NextResponse } from 'next/server';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';
import { revokeWorkspaceInvitation } from '@/lib/auth/invitationService';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invitationId } = await params;
    const context = await getAuthorizedWorkspaceContext(req, 'members:invite');

    await revokeWorkspaceInvitation(
      context.workspaceId,
      invitationId,
      context.user.userId,
      context.user.email
    );

    return NextResponse.json({
      success: true,
      message: 'Invitation revoked successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to revoke invitation' },
      { status: err.statusCode || 400 }
    );
  }
}
