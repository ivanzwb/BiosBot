/**
 * routes/index.ts — 路由聚合
 *
 * 统一将各业务路由挂载到 /api 前缀下。
 */

import { Router } from 'express';
import { healthCheck } from '../controllers/health.controller';
import { listAgents, refreshAgents, updateAgentConfig, createAgentConfig, deleteAgentConfig, listSkills, createSkill, updateSkill, deleteSkill, listTools, createTool, updateTool, deleteTool, scriptUploadMiddleware, uploadToolScript, listGlobalTools, createGlobalTool, updateGlobalTool, deleteGlobalTool, globalScriptUploadMiddleware, uploadGlobalToolScript, listMcpServers, getMcpServerTools, createMcpServer, updateMcpServer, deleteMcpServer, installMcpPackage, listInstalledMcpPackages, probeMcpPackageTools, testMcpServer } from '../controllers/agent.controller';
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

// 创建 Agent
router.post('/agents', createAgentConfig);

// 手动刷新 Agent 发现
router.post('/agents/refresh', refreshAgents);

// 更新 Agent 配置
router.put('/agents/:id/config', updateAgentConfig);

// Skill CRUD
router.get('/agents/:id/skills', listSkills);
router.post('/agents/:id/skills', createSkill);
router.put('/agents/:id/skills/:skillId', updateSkill);
router.delete('/agents/:id/skills/:skillId', deleteSkill);

// Tool CRUD
router.get('/agents/:id/tools', listTools);
router.post('/agents/:id/tools', createTool);
router.put('/agents/:id/tools/:toolId', updateTool);
router.delete('/agents/:id/tools/:toolId', deleteTool);
// Tool Script Upload
router.post('/agents/:id/tools/:toolId/script', scriptUploadMiddleware, uploadToolScript);

// Global Tool CRUD （全局Tools，所有 Agent 可用）
router.get('/global-tools', listGlobalTools);
router.post('/global-tools', createGlobalTool);
router.put('/global-tools/:toolId', updateGlobalTool);
router.delete('/global-tools/:toolId', deleteGlobalTool);
// Global Tool Script Upload
router.post('/global-tools/:toolId/script', globalScriptUploadMiddleware, uploadGlobalToolScript);

// MCP Server CRUD（MCP 服务器配置）
router.get('/mcp-servers', listMcpServers);
router.get('/mcp-servers/packages', listInstalledMcpPackages); // 列出已安装的 MCP 包
router.get('/mcp-servers/:serverId/tools', getMcpServerTools);
router.post('/mcp-servers', createMcpServer);
router.post('/mcp-servers/install', installMcpPackage);  // 安装 MCP 包
router.post('/mcp-servers/probe-tools', probeMcpPackageTools);  // 探测已安装包的 tools
router.post('/mcp-servers/test', testMcpServer);  // 测试 MCP Server 配置
router.put('/mcp-servers/:serverId', updateMcpServer);
router.delete('/mcp-servers/:serverId', deleteMcpServer);

// 删除 Agent
router.delete('/agents/:id', deleteAgentConfig);

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
