import { Request, Response } from 'express';
import * as deptService from '../services/department.service';
import { sendResponse, sendError } from '../utils/apiResponse';

export const create = async (req: Request, res: Response) => {
    try {
        const dept = await deptService.createDepartment(req.body, req.user);
        return sendResponse(res, 201, 'Department created successfully', dept);
    } catch (err: any) {
        return sendError(res, 400, err.message);
    }
};

export const list = async (req: Request, res: Response) => {
    try {
        const departments = await deptService.getDepartments(req.scope);
        return sendResponse(res, 200, 'Departments fetched', departments);
    } catch (err: any) {
        return sendError(res, 400, err.message);
    }
};

export const update = async (req: Request, res: Response) => {
    try {
        const dept = await deptService.updateDepartment(req.params.id as string, req.scope, req.body, req.user);
        return sendResponse(res, 200, 'Department updated', dept);
    } catch (err: any) {
        return sendError(res, 400, err.message);
    }
};
