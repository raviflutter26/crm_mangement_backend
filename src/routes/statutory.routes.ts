import { Router } from 'express';
import { getStatutoryConfig, updateStatutoryConfig } from '../controllers/statutory.controller';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.use(protect);
router.use(authorize('admin', 'hr', 'superadmin'));

router.get('/', getStatutoryConfig);
router.put('/', updateStatutoryConfig);

export default router;
