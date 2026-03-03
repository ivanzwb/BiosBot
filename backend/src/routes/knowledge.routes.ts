/**
 * knowledge.routes.ts — 知识库管理路由
 */

import { Router } from 'express';
import * as KnowledgeCtrl from '../controllers/knowledge.controller';

const router = Router();

// GET    /api/knowledge/:agentId — 获取知识库状态
router.get('/:agentId', KnowledgeCtrl.getKnowledgeStatus);

// DELETE /api/knowledge/:agentId — 清空知识库
router.delete('/:agentId', KnowledgeCtrl.clearKnowledge);

export default router;
