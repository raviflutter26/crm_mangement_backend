import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { sendResponse, sendError } from '../utils/apiResponse';

export const create = async (req: Request, res: Response) => {
    try {
        const result = await userService.createUser(req.body, req.user);
        return sendResponse(res, 201, 'User created and invite sent', result);
    } catch (err: any) {
        return sendError(res, 400, err.message);
    }
};

export const list = async (req: Request, res: Response) => {
    try {
        const { users, meta } = await userService.getUsers(req.scope, req.query);
        return sendResponse(res, 200, 'Users fetched successfully', users, meta);
    } catch (err: any) {
        return sendError(res, 400, err.message);
    }
};

export const getById = async (req: Request, res: Response) => {
    try {
        const user = await userService.getUserById(req.params.id as string, req.scope);
        return sendResponse(res, 200, 'User details fetched', user);
    } catch (err: any) {
        return sendError(res, 404, err.message);
    }
};
