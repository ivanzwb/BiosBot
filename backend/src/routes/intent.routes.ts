/**
 * intent.routes.ts — 意图识别路由
 */

import { Router } from 'express';
import * as IntentCtrl from '../controllers/intent.controller';

const router = Router();

// POST /api/intent/classify
router.post('/classify', IntentCtrl.classify);

export default router;
