import express from 'express';
import * as inviteController from '../controllers/invitation.controller';
import { protect } from '../middleware/auth';
import { authorize, authorizeScope } from '../middleware/rbac';

const router = express.Router();

router.use(protect, authorizeScope);

router.get('/', authorize('superadmin', 'admin', 'hr'), inviteController.list);
router.post('/resend/:id', authorize('superadmin', 'admin', 'hr'), inviteController.resend);
router.delete('/:id', authorize('superadmin', 'admin'), inviteController.revoke);

export default router;
