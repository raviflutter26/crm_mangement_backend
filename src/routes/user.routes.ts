import express from 'express';
import * as userController from '../controllers/user.controller';
import { protect } from '../middleware/auth';
import { authorize, authorizeScope } from '../middleware/rbac';

const router = express.Router();

router.use(protect, authorizeScope);

// Create user: SuperAdmin, Admin, or HR only
router.post('/', authorize('superadmin', 'admin', 'hr'), userController.create);

// List users: Subject to scope filter
router.get('/', userController.list);

// Get specific user: Subject to scope filter
router.get('/:id', userController.getById);

export default router;
