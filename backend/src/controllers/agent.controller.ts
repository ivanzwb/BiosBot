/**
 * agent.controller.ts — Agent 相关控制器
 */

import { Request, Response, NextFunction } from 'express';
import { runProxyAgentWorkflow, getRegisteredAgents } from '../agents/proxy-agent';
import { discoverAndRegisterAgents } from '../agents/agent-discovery';
import { loadProxySkills } from '../agents/proxy-agent';
import { getConfigJSON } from '../models/config.model';
import * as ChatService from '../services/chat.service';
import * as TaskService from '../services/task.service';
import { createAgentLog } from '../models/agent-log.model';
import { ingestDocuments } from '../agents/rag-service';
import { InvokeRequest, InvokeResponse, IngestRequest, IngestResponse } from '../types/api.types';
import logger from '../infra/logger/logger';

/**
 * POST /api/agent/invoke
 *
 * 调用 proxy-agent（或指定 Agent）完成任务。
 * 同步返回 taskId + 初步状态；后台异步推进。
 */
export async function invoke(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as InvokeRequest;
    if (!body.query || !body.conversationId) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'query and conversationId required' });
      return;
    }

    // 1. 保存用户消息
    ChatService.addMessage(body.conversationId, 'user', body.query);

    // 2. 创建任务
    const task = TaskService.createTask('agent_invoke', body, body.conversationId);

    // 3. 异步执行（不阻塞响应）
    setImmediate(async () => {
      const startTime = Date.now();
      try {
        TaskService.heartbeat(task.id);
        // 通过 proxy-agent 统一编排
        const result = await runProxyAgentWorkflow({
          type: 'invoke',
          payload: {
            id: body.agentId || 'proxy-agent',
            conversationId: body.conversationId,
            query: body.query,
            context: body.context ? { extra: body.context.extra as Record<string, unknown> } : undefined,
            options: body.options,
          },
        });

        const answer = result.answer || '（无回答）';
        const latency = Date.now() - startTime;

        // 保存 assistant 消息
        ChatService.addMessage(body.conversationId, 'assistant', answer);

        // 保存 Agent 日志
        createAgentLog(body.conversationId, body.agentId || 'proxy-agent', body, result, latency, true);

        // 标记任务成功
        TaskService.succeedTask(task.id, { answer });
      } catch (err) {
        const latency = Date.now() - startTime;
        const errorMsg = err instanceof Error ? err.message : String(err);
        createAgentLog(body.conversationId, body.agentId || 'proxy-agent', body, { error: errorMsg }, latency, false);
        TaskService.failTask(task.id, errorMsg);
        logger.error('agent.controller invoke async error', { taskId: task.id, error: err });
      }
    });

    // 4. 立即返回任务 ID
    const response: InvokeResponse = {
      taskId: task.id,
      status: 'pending',
      answer: null,
    };
    res.status(202).json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/agents
 *
 * 返回所有可用 Agent 列表与配置。
 * 优先从运行时 registry（DomainAgent 元数据）获取，再合并 DB 配置（模型分配、启用状态）。
 */
export function listAgents(_req: Request, res: Response, next: NextFunction): void {
  try {
    const mapping = getConfigJSON<any>('agent_model_mapping') || {};
    const dbAgents: Record<string, any> = mapping.agents || {};

    // 从运行时已注册的 DomainAgent 实例构建列表
    const registeredAgents = getRegisteredAgents();

    const agents = registeredAgents.map((agent) => {
      const dbCfg = dbAgents[agent.id] || {};
      return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        skills: agent.skills || [],
        loadedSkills: (agent.loadedSkills || []).map(s => ({ id: s.id, name: s.name, description: s.description })),
        enabled: dbCfg.enabled ?? true,
        defaultModel: dbCfg.model || mapping.defaultModel || null,
      };
    });

    res.json(agents);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/agents/refresh
 *
 * 手动刷新 Agent 发现：清空注册表、重新扫描 agents/ 目录并注册。
 */
export function refreshAgents(_req: Request, res: Response, next: NextFunction): void {
  try {
    const agents = discoverAndRegisterAgents(true);
    // 同时重新加载 proxy-agent 的 Skill
    const proxySkills = loadProxySkills();
    logger.info(`agent.controller: refreshed agents, ${agents.length} registered, ${proxySkills.length} proxy skills`);
    res.json({
      message: `刷新完成，共发现 ${agents.length} 个领域 Agent`,
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        skills: a.skills || [],
        loadedSkills: (a.loadedSkills || []).map(s => ({ id: s.id, name: s.name, description: s.description })),
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/agent/ingest
 *
 * 知识库文档导入 — 对接 RAG 服务，向量化后写入 Agent 的 LanceDB 知识库。
 */
export async function ingest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as IngestRequest;
    if (!body.agentId || !body.documents?.length) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'agentId and documents required' });
      return;
    }

    const task = TaskService.createTask('ingest', body, body.conversationId);

    // 查找 Agent 的 dataDir（用于定位 LanceDB 目录）
    const agent = getRegisteredAgents().find((a) => a.id === body.agentId);
    const dataDir = agent?.dataDir;

    // 异步执行文档解析 → Embedding → LanceDb 写入
    setImmediate(async () => {
      try {
        logger.info('agent.controller ingest: processing documents', {
          agentId: body.agentId,
          count: body.documents.length,
        });

        const recordCount = await ingestDocuments(body.agentId, body.documents, dataDir);

        logger.info('agent.controller ingest: completed', {
          agentId: body.agentId,
          records: recordCount,
        });
        TaskService.succeedTask(task.id, { imported: body.documents.length, records: recordCount });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error('agent.controller ingest error', { agentId: body.agentId, error: err });
        TaskService.failTask(task.id, errorMsg);
      }
    });

    const response: IngestResponse = { taskId: task.id, status: 'pending' };
    res.status(202).json(response);
  } catch (err) {
    next(err);
  }
}
