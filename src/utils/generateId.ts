import User from '../models/User';

/**
 * Generates an employee ID in the format EMP0001, EMP0002...
 * The ID is scoped within an organization.
 */
export const generateEmployeeId = async (organizationId: string): Promise<string> => {
    const lastUser = await User.findOne({ organizationId })
        .sort({ createdAt: -1 })
        .select('employeeId');

    let nextNumber = 1;
    if (lastUser && lastUser.employeeId) {
        const lastNumberMatch = lastUser.employeeId.match(/\d+/);
        if (lastNumberMatch) {
            nextNumber = parseInt(lastNumberMatch[0]) + 1;
        }
    }

    return `EMP${nextNumber.toString().padStart(4, '0')}`;
};
