/**
 * agent.routes.ts — Agent 调用 & 管理路由
 */

import { Router } from 'express';
import * as AgentCtrl from '../controllers/agent.controller';

const router = Router();

// POST /api/agent/invoke — 调用 Agent 完成任务
router.post('/invoke', AgentCtrl.invoke);

// POST /api/agent/ingest — 知识库文档导入
router.post('/ingest', AgentCtrl.ingest);

// GET /api/agents — 获取可用 Agent 列表
// 注意：此路由挂载在 /api/agents 前缀下（见 routes/index.ts）
// 此处放在 agent.routes 中，通过 index 以 /api/agents 路径挂载 GET /

export default router;
