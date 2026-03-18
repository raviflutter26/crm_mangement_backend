const axios = require('axios');
const Employee = require('../models/Employee');

/**
 * @desc    Fetch Bank details from IFSC Code
 * @route   GET /api/bank/ifsc/:code
 */
exports.getIFSCDetails = async (req, res, next) => {
    try {
        const { code } = req.params;
        const response = await axios.get(`https://ifsc.razorpay.com/${code}`);
        res.status(200).json({
            success: true,
            data: {
                bank: response.data.BANK,
                branch: response.data.BRANCH,
                ifsc: response.data.IFSC,
                city: response.data.CITY,
                state: response.data.STATE
            }
        });
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ success: false, message: 'Invalid IFSC Code' });
        }
        res.status(500).json({ success: false, message: 'Unable to fetch bank details' });
    }
};

/**
 * @desc    Update Employee Bank Details
 * @route   POST /api/employee/bank-details
 */
exports.updateBankDetails = async (req, res, next) => {
    try {
        const { employeeId, bankDetails } = req.body;

        if (!employeeId || !bankDetails) {
            return res.status(400).json({ success: false, message: 'Employee ID and bank details are required' });
        }

        const { accountHolderName, accountNumber, ifscCode, bankName, branchName } = bankDetails;

        // Validation
        if (!accountHolderName || !accountNumber || !ifscCode) {
            return res.status(400).json({ success: false, message: 'Required fields missing' });
        }

        if (!/^\d{9,18}$/.test(accountNumber)) {
            return res.status(400).json({ success: false, message: 'Account number must be 9-18 digits' });
        }

        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
            return res.status(400).json({ success: false, message: 'Invalid IFSC format' });
        }

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        // Update using the virtual for accountNumber (which handles encryption)
        employee.bankDetails = {
            ...employee.bankDetails,
            accountHolderName,
            ifscCode,
            bankName,
            branchName,
            upiId: bankDetails.upiId || employee.bankDetails.upiId
        };
        
        // Use the virtual setter
        employee.set('bankDetails.accountNumber', accountNumber);

        await employee.save();

        res.status(200).json({
            success: true,
            message: 'Bank details updated successfully',
            data: {
                ...employee.bankDetails.toObject(),
                accountNumber: employee.bankDetails.accountNumber // Masked/Decrypted as per virtual get
            }
        });
    } catch (error) {
        next(error);
    }
};
