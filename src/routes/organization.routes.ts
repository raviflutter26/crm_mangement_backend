import express from 'express';
import { body } from 'express-validator';
import * as orgController from '../controllers/organization.controller';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = express.Router();

// Only SuperAdmin can manage organizations
router.use(protect, authorize('superadmin'));

router.get('/', orgController.getAll);
router.post('/', [
    body('name').notEmpty().withMessage('Organization name is required'),
    body('email').isEmail().withMessage('Valid organization email is required'),
    body('industry').notEmpty().withMessage('Industry is required'),
    body('admin.email').isEmail().withMessage('Valid admin email is required'),
    body('admin.firstName').notEmpty().withMessage('Admin first name is required'),
    body('admin.lastName').notEmpty().withMessage('Admin last name is required'),
], orgController.create);
router.get('/:id', orgController.getOne);
router.put('/:id', orgController.update);
router.delete('/:id', orgController.remove);
router.patch('/:id/status', orgController.updateStatus);
router.post('/:id/impersonate', orgController.impersonate);

export default router;
