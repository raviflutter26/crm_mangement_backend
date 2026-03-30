import { Request, Response } from 'express';
import { sendResponse } from '../utils/apiResponse';

/**
 * GET /api/master/industries
 * Returns a static list of industries for the onboarding dropdown.
 */
export const getIndustries = async (req: Request, res: Response) => {
    const industries = [
        "Information Technology",
        "Healthcare",
        "Finance",
        "Education",
        "Manufacturing",
        "Retail",
        "Real Estate",
        "Logistics",
        "Automotive",
        "Hospitality",
        "Construction",
        "Media & Entertainment",
        "Agriculture",
        "Pharma",
        "Consulting"
    ];

    return sendResponse(res, 200, 'Industries fetched successfully', industries);
};
