import { Response } from 'express';

export interface IApiResponse {
    success: boolean;
    message: string;
    data?: any;
    meta?: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
    error?: string;
    statusCode?: number;
}

export const sendResponse = (
    res: Response,
    statusCode: number,
    message: string,
    data?: any,
    meta?: any
) => {
    return res.status(statusCode).json({
        success: statusCode >= 200 && statusCode < 300,
        message,
        data,
        meta
    });
};

export const sendError = (
    res: Response,
    statusCode: number,
    message: string,
    error?: string
) => {
    return res.status(statusCode).json({
        success: false,
        message,
        error: error || 'INTERNAL_SERVER_ERROR',
        statusCode
    });
};
