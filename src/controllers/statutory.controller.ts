import { Request, Response } from 'express';
import { StatutoryService } from '../services/statutory.service';
import { sendResponse, sendError } from '../utils/apiResponse';

export const getStatutoryConfig = async (req: Request, res: Response) => {
    try {
        const config = await StatutoryService.getConfig(req.user!.organizationId.toString());
        return sendResponse(res, 200, 'Statutory configuration retrieved', config || {});
    } catch (error: any) {
        return sendError(res, 500, error.message);
    }
};

export const updateStatutoryConfig = async (req: Request, res: Response) => {
    try {
        const config = await StatutoryService.updateConfig(
            req.user!.organizationId.toString(),
            req.body,
            req.user!.id,
            req.user!.role
        );
        return sendResponse(res, 200, 'Statutory configuration updated', config);
    } catch (error: any) {
        return sendError(res, 400, error.message);
    }
};
