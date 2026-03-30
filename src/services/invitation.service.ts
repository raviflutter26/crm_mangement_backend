import Invitation, { IInvitation } from '../models/Invitation';
import User from '../models/User';
import crypto from 'crypto';
import { logAuditManual } from '../middleware/auditLogger';

export const getInvitations = async (scope: any) => {
    return await Invitation.find(scope).sort({ createdAt: -1 });
};

export const resendInvitation = async (id: string, scope: any, actor: any) => {
    const invite = await Invitation.findOne({ _id: id, ...scope, status: 'pending' });
    if (!invite) throw new Error('Pending invitation not found');

    invite.token = crypto.randomBytes(32).toString('hex');
    invite.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await invite.save();

    // In a full app, call emailService here

    logAuditManual({
        actorId: actor._id,
        actorRole: actor.role,
        organizationId: actor.organizationId,
        action: 'RESEND_INVITATION',
        module: 'invitations',
        targetId: invite._id,
        targetModel: 'Invitation'
    });

    return invite;
};

export const revokeInvitation = async (id: string, scope: any, actor: any) => {
    const invite = await Invitation.findOne({ _id: id, ...scope });
    if (!invite) throw new Error('Invitation not found');

    await Invitation.findByIdAndDelete(id);

    logAuditManual({
        actorId: actor._id,
        actorRole: actor.role,
        organizationId: actor.organizationId,
        action: 'REVOKE_INVITATION',
        module: 'invitations',
        targetId: invite._id,
        targetModel: 'Invitation'
    });
};
