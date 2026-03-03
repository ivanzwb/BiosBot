/**
 * routes/index.ts — 路由聚合
 *
 * 统一将各业务路由挂载到 /api 前缀下。
 */

import { Router } from 'express';
import { healthCheck } from '../controllers/health.controller';
import { listAgents, refreshAgents } from '../controllers/agent.controller';
import intentRoutes from './intent.routes';
import agentRoutes from './agent.routes';
import chatRoutes from './chat.routes';
import knowledgeRoutes from './knowledge.routes';
import adminRoutes from './admin.routes';

const router = Router();

// 健康检查
router.get('/health', healthCheck);

// 意图识别
router.use('/intent', intentRoutes);

// Agent 调用
router.use('/agent', agentRoutes);

// Agent 列表（独立路径 /api/agents）
router.get('/agents', listAgents);

// 手动刷新 Agent 发现
router.post('/agents/refresh', refreshAgents);

// 对话管理
router.use('/conversations', chatRoutes);

// 知识库管理
router.use('/knowledge', knowledgeRoutes);

// 运维 & 配置 & 任务
router.use('/admin', adminRoutes);

// 任务快捷路由（/api/tasks 映射到 admin 下的任务路由）
router.get('/tasks', (req, res, next) => {
  // 转发到 admin 路由
  req.url = '/tasks' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  adminRoutes(req, res, next);
});

router.get('/tasks/:id', (req, res, next) => {
  req.url = `/tasks/${req.params.id}`;
  adminRoutes(req, res, next);
});

export default router;
