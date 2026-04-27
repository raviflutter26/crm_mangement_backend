import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as orgService from '../services/organization.service';
import { sendResponse, sendError } from '../utils/apiResponse';

export const create = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return sendError(res, 400, "Validation failed", errors.array()[0].msg);
    }

    try {
        const { admin, ...orgData } = req.body;
        const org = await orgService.createOrganization(orgData, admin, req.user);
        return sendResponse(res, 201, 'Organization and Admin created successfully', org);
    } catch (err: any) {
        return sendError(res, 400, err.message);
    }
};

export const getAll = async (req: Request, res: Response) => {
    try {
        const { search, status, planType, sort, page, limit } = req.query;
        const options = {
            search: search as string,
            status: status as string,
            planType: planType as string,
            sort: sort as string,
            page: page ? parseInt(page as string, 10) : 1,
            limit: limit ? parseInt(limit as string, 10) : 10
        };
        const result = await orgService.getAllOrganizations(options);
        return sendResponse(res, 200, 'Organizations fetched', result);
    } catch (err: any) {
        return sendError(res, 400, err.message);
    }
};

export const getOne = async (req: Request, res: Response) => {
    try {
        const org = await orgService.getOrganizationById(req.params.id as string);
        return sendResponse(res, 200, 'Organization fetched', org);
    } catch (err: any) {
        return sendError(res, 404, err.message);
    }
};

export const update = async (req: Request, res: Response) => {
    try {
        const org = await orgService.updateOrganization(req.params.id as string, req.body, req.user);
        return sendResponse(res, 200, 'Organization updated', org);
    } catch (err: any) {
        return sendError(res, 400, err.message);
    }
};

export const remove = async (req: Request, res: Response) => {
    try {
        await orgService.deleteOrganization(req.params.id as string, req.user);
        return sendResponse(res, 200, 'Organization soft deleted successfully', null);
    } catch (err: any) {
        return sendError(res, 400, err.message);
    }
};

export const updateStatus = async (req: Request, res: Response) => {
    try {
        const org = await orgService.updateOrganizationStatus(req.params.id as string, req.body.status, req.user);
        return sendResponse(res, 200, 'Organization status updated', org);
    } catch (err: any) {
        return sendError(res, 400, err.message);
    }
};

export const impersonate = async (req: Request, res: Response) => {
    try {
        const result = await orgService.impersonateOrganizationAdmin(req.params.id as string, req.user!._id.toString());
        return sendResponse(res, 200, 'Impersonation successful', result);
    } catch (err: any) {
        return sendError(res, 400, err.message);
    }
};
