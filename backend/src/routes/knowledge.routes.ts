/**
 * knowledge.routes.ts — 知识库管理路由
 */

import { Router } from 'express';
import * as KnowledgeCtrl from '../controllers/knowledge.controller';

const router = Router();

// GET    /api/knowledge/all-status — 获取所有 Agent 知识库状态
router.get('/all-status', KnowledgeCtrl.getAllKnowledgeStatus);

// GET    /api/knowledge/:agentId — 获取知识库状态
router.get('/:agentId', KnowledgeCtrl.getKnowledgeStatus);

// DELETE /api/knowledge/:agentId — 清空知识库
router.delete('/:agentId', KnowledgeCtrl.clearKnowledge);

// GET    /api/knowledge/:agentId/documents — 列出文档
router.get('/:agentId/documents', KnowledgeCtrl.listKnowledgeDocs);

// DELETE /api/knowledge/:agentId/documents/:docId — 删除单篇文档
router.delete('/:agentId/documents/:docId', KnowledgeCtrl.deleteKnowledgeDoc);

// POST   /api/knowledge/:agentId/ingest-conversation — 导入对话到知识库
router.post('/:agentId/ingest-conversation', KnowledgeCtrl.ingestConversation);

export default router;
