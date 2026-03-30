import express from 'express';
import * as deptController from '../controllers/department.controller';
import { protect } from '../middleware/auth';
import { authorize, authorizeScope } from '../middleware/rbac';

const router = express.Router();

router.use(protect, authorizeScope);

router.get('/', deptController.list);
router.post('/', authorize('superadmin', 'admin'), deptController.create);
router.put('/:id', authorize('superadmin', 'admin'), deptController.update);

export default router;
