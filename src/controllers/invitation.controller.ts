import { Request, Response } from 'express';
import * as inviteService from '../services/invitation.service';
import { sendResponse, sendError } from '../utils/apiResponse';

export const list = async (req: Request, res: Response) => {
    try {
        const invitations = await inviteService.getInvitations(req.scope);
        return sendResponse(res, 200, 'Invitations fetched', invitations);
    } catch (err: any) {
        return sendError(res, 400, err.message);
    }
};

export const resend = async (req: Request, res: Response) => {
    try {
        const invite = await inviteService.resendInvitation(req.params.id as string, req.scope, req.user);
        return sendResponse(res, 200, 'Invitation token regenerated', invite);
    } catch (err: any) {
        return sendError(res, 400, err.message);
    }
};

export const revoke = async (req: Request, res: Response) => {
    try {
        await inviteService.revokeInvitation(req.params.id as string, req.scope, req.user);
        return sendResponse(res, 200, 'Invitation revoked successfully');
    } catch (err: any) {
        return sendError(res, 400, err.message);
    }
};
