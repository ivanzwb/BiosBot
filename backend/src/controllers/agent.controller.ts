/**
 * agent.controller.ts — Agent 相关控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';
import { runProxyAgentWorkflow, getRegisteredAgents, getProxyAgentDir } from '../agents/proxy-agent';
import { discoverAndRegisterAgents, DbAgentConfig } from '../agents/agent-discovery';
import { loadProxySkills } from '../agents/proxy-agent';
import { loadSkills } from '../agents/skill-loader';
import { loadAgentToolConfigs, AgentToolConfig } from '../agents/tool-loader';
import { getConfigJSON, upsertConfig } from '../models/config.model';
import * as ChatService from '../services/chat.service';
import * as TaskService from '../services/task.service';
import { createAgentLog } from '../models/agent-log.model';
import { ingestDocuments } from '../agents/rag-service';
import { InvokeRequest, InvokeResponse, IngestRequest, IngestResponse } from '../types/api.types';
import { broadcastTaskUpdate, broadcastNewMessage, broadcastExecutionStep } from '../services/ws.service';
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

        // 加载对话历史（短期记忆）
        const history = ChatService.listMessages(body.conversationId);

        // 通过 proxy-agent 统一编排
        const result = await runProxyAgentWorkflow({
          type: 'invoke',
          payload: {
            id: body.agentId || 'proxy-agent',
            conversationId: body.conversationId,
            query: body.query,
            context: {
              history,
              extra: body.context?.extra as Record<string, unknown>,
            },
            options: body.options,
          },
          // 实时推送执行步骤
          onStep: (step) => {
            broadcastExecutionStep(body.conversationId, task.id, step);
          },
        });

        const answer = result.answer || '（无回答）';
        const latency = Date.now() - startTime;

        // 保存 assistant 消息
        const assistantMsg = ChatService.addMessage(body.conversationId, 'assistant', answer);

        // 保存 Agent 日志
        createAgentLog(body.conversationId, body.agentId || 'proxy-agent', body, result, latency, true);

        // 标记任务成功
        TaskService.succeedTask(task.id, { answer });

        // WebSocket 推送
        broadcastNewMessage(body.conversationId, assistantMsg);
        broadcastTaskUpdate(task.id, 'succeeded', { answer });
      } catch (err) {
        const latency = Date.now() - startTime;
        const errorMsg = err instanceof Error ? err.message : String(err);
        createAgentLog(body.conversationId, body.agentId || 'proxy-agent', body, { error: errorMsg }, latency, false);
        TaskService.failTask(task.id, errorMsg);
        broadcastTaskUpdate(task.id, 'failed', undefined, errorMsg);
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
    const modelsConfig = getConfigJSON<any[]>('models') || [];
    const domainAgents = getConfigJSON<DbAgentConfig[]>('domain_agents') || [];
    const domainAgentsMap = new Map(domainAgents.map(a => [a.id, a]));

    // 从运行时已注册的 DomainAgent 实例构建列表
    const registeredAgents = getRegisteredAgents();

    const agents = registeredAgents.map((agent) => {
      const dbCfg = dbAgents[agent.id] || {};
      const rawModelId = dbCfg.model || mapping.defaultModel || null;
      const modelId = rawModelId && typeof rawModelId === 'object' ? (rawModelId.model || rawModelId.id || null) : rawModelId;
      const modelEntry = modelId
        ? (modelsConfig.find((m: any) => m.id === modelId) || modelsConfig.find((m: any) => m.model === modelId))
        : null;

      // 优先从 DB domain_agents 读取配置，回退到文件系统
      const dbDomainCfg = domainAgentsMap.get(agent.id);
      let defaultTemperature: number | undefined = dbDomainCfg?.defaultTemperature;
      let systemPrompt = dbDomainCfg?.systemPrompt || '';
      const source: 'db' | 'file' = dbDomainCfg ? 'db' : 'file';

      if (!dbDomainCfg && agent.dataDir) {
        try {
          const jsonPath = path.join(agent.dataDir, 'agent.json');
          if (fs.existsSync(jsonPath)) {
            const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            defaultTemperature = raw.defaultTemperature;
          }
        } catch { /* ignore */ }
        try {
          const promptPath = path.join(agent.dataDir, 'prompt.md');
          if (fs.existsSync(promptPath)) {
            systemPrompt = fs.readFileSync(promptPath, 'utf-8').trim();
          }
        } catch { /* ignore */ }
      }

      return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        labels: agent.labels || [],
        loadedSkills: (agent.loadedSkills || []).map(s => ({ id: s.id, name: s.name, description: s.description })),
        enabled: dbCfg.enabled ?? true,
        model: modelEntry ? modelEntry.name : (modelId || null),
        defaultTemperature,
        systemPrompt,
        source,
        mcpServers: dbDomainCfg?.mcpServers || [],
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
        labels: a.labels || [],
        loadedSkills: (a.loadedSkills || []).map(s => ({ id: s.id, name: s.name, description: s.description })),
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/agents/:id/config
 *
 * 更新 Domain Agent 的配置（name, description, labels, defaultTemperature, systemPrompt, mcpServers）。
 * DB Agent → 更新 domain_agents 配置；文件系统 Agent → 写回 agent.json 和 prompt.md。
 */
export function updateAgentConfig(req: Request, res: Response, next: NextFunction): void {
  try {
    const agentId = req.params.id as string;
    const { name, description, labels, defaultTemperature, systemPrompt, mcpServers } = req.body;

    // 检查是否是 DB Agent
    const domainAgents = getConfigJSON<DbAgentConfig[]>('domain_agents') || [];
    const dbIdx = domainAgents.findIndex(a => a.id === agentId);

    if (dbIdx >= 0) {
      // DB Agent：更新 domain_agents 配置
      if (name !== undefined) domainAgents[dbIdx].name = name;
      if (description !== undefined) domainAgents[dbIdx].description = description;
      if (labels !== undefined) domainAgents[dbIdx].labels = labels;
      if (defaultTemperature !== undefined) domainAgents[dbIdx].defaultTemperature = defaultTemperature;
      if (systemPrompt !== undefined) domainAgents[dbIdx].systemPrompt = systemPrompt;
      if (mcpServers !== undefined) domainAgents[dbIdx].mcpServers = mcpServers;
      upsertConfig('domain_agents', JSON.stringify(domainAgents));
    } else {
      // 文件系统 Agent：写回 agent.json + prompt.md
      const agent = getRegisteredAgents().find((a) => a.id === agentId);
      if (!agent || !agent.dataDir) {
        res.status(404).json({ code: 'NOT_FOUND', message: `Agent "${agentId}" not found` });
        return;
      }

      const jsonPath = path.join(agent.dataDir, 'agent.json');
      const promptPath = path.join(agent.dataDir, 'prompt.md');

      let agentJson: any = {};
      try {
        agentJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      } catch { /* 文件不存在则新建 */ }

      if (name !== undefined) agentJson.name = name;
      if (description !== undefined) agentJson.description = description;
      if (labels !== undefined) agentJson.labels = labels;
      if (defaultTemperature !== undefined) agentJson.defaultTemperature = defaultTemperature;
      agentJson.id = agentId;

      fs.writeFileSync(jsonPath, JSON.stringify(agentJson, null, 2) + '\n', 'utf-8');

      if (systemPrompt !== undefined) {
        fs.writeFileSync(promptPath, systemPrompt.trim() + '\n', 'utf-8');
      }

      // 对于文件系统 Agent，mcpServers 存储在 domain_agents 中（创建或更新一条记录）
      if (mcpServers !== undefined) {
        const existingIdx = domainAgents.findIndex(a => a.id === agentId);
        if (existingIdx >= 0) {
          domainAgents[existingIdx].mcpServers = mcpServers;
        } else if (mcpServers.length > 0) {
          // 创建一条最小记录，只存 mcpServers
          domainAgents.push({
            id: agentId,
            name: agentJson.name || agent.name,
            description: agentJson.description || agent.description || '',
            mcpServers,
          });
        }
        upsertConfig('domain_agents', JSON.stringify(domainAgents));
      }
    }

    // 热刷新 Agent 注册表
    discoverAndRegisterAgents(true);
    loadProxySkills();

    logger.info('agent.controller: updated agent config', { agentId, name, description });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/agents
 *
 * 创建新的 Domain Agent（存储在数据库 domain_agents 配置中）。
 */
export function createAgentConfig(req: Request, res: Response, next: NextFunction): void {
  try {
    const { id, name, description, labels, defaultTemperature, systemPrompt } = req.body;
    if (!id || !name) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'id and name are required' });
      return;
    }

    // 检查 id 是否已存在（DB 或运行时）
    const domainAgents = getConfigJSON<DbAgentConfig[]>('domain_agents') || [];
    if (domainAgents.some(a => a.id === id)) {
      res.status(409).json({ code: 'CONFLICT', message: `Agent "${id}" already exists` });
      return;
    }
    if (getRegisteredAgents().some(a => a.id === id)) {
      res.status(409).json({ code: 'CONFLICT', message: `Agent "${id}" already exists in file system` });
      return;
    }

    const newAgent: DbAgentConfig = {
      id,
      name,
      description: description || '',
      labels: labels || [],
      defaultTemperature: defaultTemperature ?? 0.5,
      systemPrompt: systemPrompt || `你是 ${name}（${id}）。${description || ''}`,
    };

    domainAgents.push(newAgent);
    upsertConfig('domain_agents', JSON.stringify(domainAgents));

    // 热刷新使 Agent 立即生效
    discoverAndRegisterAgents(true);
    loadProxySkills();

    logger.info('agent.controller: created new agent', { id, name });
    res.status(201).json({ success: true, agent: newAgent });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/agents/:id
 *
 * 删除 Agent（DB Agent 删配置，文件系统 Agent 删目录）。
 */
export function deleteAgentConfig(req: Request, res: Response, next: NextFunction): void {
  try {
    const agentId = req.params.id as string;
    let deleted = false;

    // 1. 尝试从 DB 删除
    const domainAgents = getConfigJSON<DbAgentConfig[]>('domain_agents') || [];
    const idx = domainAgents.findIndex(a => a.id === agentId);
    if (idx >= 0) {
      domainAgents.splice(idx, 1);
      upsertConfig('domain_agents', JSON.stringify(domainAgents));
      deleted = true;
    }

    // 2. 尝试从文件系统删除（内置 agent 目录）
    if (!deleted) {
      const registeredAgent = getRegisteredAgents().find(a => a.id === agentId);
      if (!registeredAgent) {
        res.status(404).json({ code: 'NOT_FOUND', message: `Agent "${agentId}" not found` });
        return;
      }
      if (registeredAgent.dataDir && fs.existsSync(registeredAgent.dataDir)) {
        fs.rmSync(registeredAgent.dataDir, { recursive: true, force: true });
        deleted = true;
      }
    }

    // 同时清理 agent_model_mapping 中的配置
    const mapping = getConfigJSON<any>('agent_model_mapping') || {};
    if (mapping.agents?.[agentId]) {
      delete mapping.agents[agentId];
      upsertConfig('agent_model_mapping', JSON.stringify(mapping));
    }

    // 热刷新
    discoverAndRegisterAgents(true);
    loadProxySkills();

    logger.info('agent.controller: deleted agent', { agentId });
    res.json({ success: true });
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
        broadcastTaskUpdate(task.id, 'succeeded', { imported: body.documents.length, records: recordCount });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error('agent.controller ingest error', { agentId: body.agentId, error: err });
        TaskService.failTask(task.id, errorMsg);
        broadcastTaskUpdate(task.id, 'failed', undefined, errorMsg);
      }
    });

    const response: IngestResponse = { taskId: task.id, status: 'pending' };
    res.status(202).json(response);
  } catch (err) {
    next(err);
  }
}

// ============================================================
// Skill CRUD
// ============================================================

/**
 * 获取 Agent 的 dataDir，若不存在则返回 null 并写 404。
 */
function resolveAgentDir(agentId: string, res: Response): string | null {
  // proxy-agent 不在注册表中，特殊处理
  if (agentId === 'proxy-agent') {
    return getProxyAgentDir();
  }
  const agent = getRegisteredAgents().find(a => a.id === agentId);
  if (!agent || !agent.dataDir) {
    res.status(404).json({ code: 'NOT_FOUND', message: `Agent "${agentId}" not found` });
    return null;
  }
  return agent.dataDir;
}

/** Helper: safely extract string param. */
function paramStr(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] : (val || '');
}

/**
 * 将 Skill 对象序列化为 Markdown（YAML frontmatter + content）。
 */
function serializeSkillMd(skill: { id: string; name: string; description: string; content: string }): string {
  return `---\nid: ${skill.id}\nname: ${skill.name}\ndescription: ${skill.description}\n---\n${skill.content}\n`;
}

/**
 * GET /api/agents/:id/skills
 *
 * 列出指定 Agent 的所有 Skill（含 content）。
 */
export function listSkills(req: Request, res: Response, next: NextFunction): void {
  try {
    const agentDir = resolveAgentDir(paramStr(req.params.id), res);
    if (!agentDir) return;

    const skills = loadSkills(agentDir);
    res.json(skills);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/agents/:id/skills
 *
 * 创建新的 Skill（写入 skills/<id>.md ）。
 */
export function createSkill(req: Request, res: Response, next: NextFunction): void {
  try {
    const agentId = paramStr(req.params.id);
    const agentDir = resolveAgentDir(agentId, res);
    if (!agentDir) return;

    const { id, name, description, content } = req.body;
    if (!id || !name || !content) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'id, name and content are required' });
      return;
    }

    const skillsDir = path.join(agentDir, 'skills');
    if (!fs.existsSync(skillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true });
    }

    const filePath = path.join(skillsDir, `${id}.md`);
    if (fs.existsSync(filePath)) {
      res.status(409).json({ code: 'CONFLICT', message: `Skill "${id}" already exists` });
      return;
    }

    fs.writeFileSync(filePath, serializeSkillMd({ id, name, description: description || '', content }), 'utf-8');

    // 热刷新 Agent 以加载新 Skill
    discoverAndRegisterAgents(true);
    loadProxySkills();

    logger.info('agent.controller: created skill', { agentId, skillId: id });
    res.status(201).json({ success: true, skill: { id, name, description: description || '', content } });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/agents/:id/skills/:skillId
 *
 * 更新已有 Skill 的内容。
 */
export function updateSkill(req: Request, res: Response, next: NextFunction): void {
  try {
    const agentId = paramStr(req.params.id);
    const agentDir = resolveAgentDir(agentId, res);
    if (!agentDir) return;

    const skillId = paramStr(req.params.skillId);
    const { name, description, content } = req.body;

    const skillsDir = path.join(agentDir, 'skills');
    const filePath = path.join(skillsDir, `${skillId}.md`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ code: 'NOT_FOUND', message: `Skill "${skillId}" not found` });
      return;
    }

    // 读取旧内容以保留未传入的字段
    const existing = loadSkills(agentDir).find(s => s.id === skillId);
    const merged = {
      id: skillId,
      name: name ?? existing?.name ?? skillId,
      description: description ?? existing?.description ?? '',
      content: content ?? existing?.content ?? '',
    };

    fs.writeFileSync(filePath, serializeSkillMd(merged), 'utf-8');

    // 热刷新
    discoverAndRegisterAgents(true);
    loadProxySkills();

    logger.info('agent.controller: updated skill', { agentId, skillId });
    res.json({ success: true, skill: merged });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/agents/:id/skills/:skillId
 *
 * 删除指定 Skill 文件。
 */
export function deleteSkill(req: Request, res: Response, next: NextFunction): void {
  try {
    const agentId = paramStr(req.params.id);
    const agentDir = resolveAgentDir(agentId, res);
    if (!agentDir) return;

    const skillId = paramStr(req.params.skillId);
    const skillsDir = path.join(agentDir, 'skills');
    const filePath = path.join(skillsDir, `${skillId}.md`);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ code: 'NOT_FOUND', message: `Skill "${skillId}" not found` });
      return;
    }

    fs.unlinkSync(filePath);

    // 热刷新
    discoverAndRegisterAgents(true);
    loadProxySkills();

    logger.info('agent.controller: deleted skill', { agentId, skillId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// Tool CRUD
// ============================================================

/**
 * GET /api/agents/:id/tools
 *
 * 列出指定 Agent 的所有 Tool 配置。
 */
export function listTools(req: Request, res: Response, next: NextFunction): void {
  try {
    const agentDir = resolveAgentDir(paramStr(req.params.id), res);
    if (!agentDir) return;

    const configs = loadAgentToolConfigs(agentDir);
    res.json(configs);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/agents/:id/tools
 *
 * 创建新的 Tool（写入 tools/<id>.json）。
 */
export function createTool(req: Request, res: Response, next: NextFunction): void {
  try {
    const agentId = paramStr(req.params.id);
    const agentDir = resolveAgentDir(agentId, res);
    if (!agentDir) return;

    const { id, name, description, parameters, handler } = req.body;
    if (!id || !name || !description) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'id, name and description are required' });
      return;
    }
    if (!handler || !handler.type) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'handler with type is required' });
      return;
    }
    if (handler.type === 'http' && !handler.url) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'handler.url is required for http type' });
      return;
    }
    if (handler.type === 'script' && !handler.runtime) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'handler.runtime is required for script type' });
      return;
    }

    const toolsDir = path.join(agentDir, 'tools');
    if (!fs.existsSync(toolsDir)) {
      fs.mkdirSync(toolsDir, { recursive: true });
    }

    const filePath = path.join(toolsDir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      res.status(409).json({ code: 'CONFLICT', message: `Tool "${id}" already exists` });
      return;
    }

    const toolConfig: AgentToolConfig = {
      id,
      name,
      description,
      parameters: parameters || [],
      handler,
      enabled: true,
    };

    fs.writeFileSync(filePath, JSON.stringify(toolConfig, null, 2) + '\n', 'utf-8');

    logger.info('agent.controller: created tool', { agentId, toolId: id });
    res.status(201).json({ success: true, tool: toolConfig });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/agents/:id/tools/:toolId
 *
 * 更新已有 Tool 的配置。
 */
export function updateTool(req: Request, res: Response, next: NextFunction): void {
  try {
    const agentId = paramStr(req.params.id);
    const agentDir = resolveAgentDir(agentId, res);
    if (!agentDir) return;

    const toolId = paramStr(req.params.toolId);
    const toolsDir = path.join(agentDir, 'tools');
    const filePath = path.join(toolsDir, `${toolId}.json`);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ code: 'NOT_FOUND', message: `Tool "${toolId}" not found` });
      return;
    }

    // 读取现有配置并合并
    let existing: AgentToolConfig;
    try {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      existing = { id: toolId, name: toolId, description: '', parameters: [], handler: { type: 'http', url: '' } };
    }

    const { name, description, parameters, handler, enabled } = req.body;
    const merged: AgentToolConfig = {
      ...existing,
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(parameters !== undefined && { parameters }),
      ...(handler !== undefined && { handler }),
      ...(enabled !== undefined && { enabled }),
    };

    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');

    logger.info('agent.controller: updated tool', { agentId, toolId });
    res.json({ success: true, tool: merged });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/agents/:id/tools/:toolId
 *
 * 删除指定 Tool 文件。
 */
export function deleteTool(req: Request, res: Response, next: NextFunction): void {
  try {
    const agentId = paramStr(req.params.id);
    const agentDir = resolveAgentDir(agentId, res);
    if (!agentDir) return;

    const toolId = paramStr(req.params.toolId);
    const toolsDir = path.join(agentDir, 'tools');
    const filePath = path.join(toolsDir, `${toolId}.json`);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ code: 'NOT_FOUND', message: `Tool "${toolId}" not found` });
      return;
    }

    // 如果是 script 类型，同时删除脚本文件
    try {
      const cfg: AgentToolConfig = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (cfg.handler?.type === 'script' && cfg.handler.scriptFile) {
        const scriptPath = path.join(toolsDir, 'scripts', cfg.handler.scriptFile);
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
          logger.info('agent.controller: deleted script file', { agentId, toolId, scriptFile: cfg.handler.scriptFile });
        }
      }
    } catch { /* ignore parse errors */ }

    fs.unlinkSync(filePath);

    logger.info('agent.controller: deleted tool', { agentId, toolId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// Tool Script Upload
// ============================================================

/** multer 配置：使用内存存储，由 controller 手动写入正确目录 */
const scriptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

/** multer 中间件导出，供路由使用 */
export const scriptUploadMiddleware = scriptUpload.single('script');

/**
 * POST /api/agents/:id/tools/:toolId/script
 *
 * 上传工具脚本文件。上传后自动更新 Tool 配置的 handler.scriptFile。
 */
export function uploadToolScript(req: Request, res: Response, next: NextFunction): void {
  try {
    const agentId = paramStr(req.params.id);
    const agentDir = resolveAgentDir(agentId, res);
    if (!agentDir) return;

    const toolId = paramStr(req.params.toolId);
    const toolsDir = path.join(agentDir, 'tools');
    const configPath = path.join(toolsDir, `${toolId}.json`);

    if (!fs.existsSync(configPath)) {
      res.status(404).json({ code: 'NOT_FOUND', message: `Tool "${toolId}" not found` });
      return;
    }

    if (!req.file) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'No script file uploaded' });
      return;
    }

    // 确保 scripts 目录存在
    const scriptsDir = path.join(toolsDir, 'scripts');
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    // 写入脚本文件
    const scriptPath = path.join(scriptsDir, req.file.originalname);
    fs.writeFileSync(scriptPath, req.file.buffer);

    // 更新 JSON 配置中的 scriptFile
    let cfg: AgentToolConfig;
    try {
      cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      cfg = { id: toolId, name: toolId, description: '', parameters: [], handler: { type: 'script', scriptFile: '', runtime: 'node' } };
    }

    // 如果之前有旧脚本文件且文件名不同，删除旧文件
    if (cfg.handler.type === 'script' && cfg.handler.scriptFile && cfg.handler.scriptFile !== req.file.originalname) {
      const oldPath = path.join(scriptsDir, cfg.handler.scriptFile);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    cfg.handler = {
      ...cfg.handler,
      type: 'script',
      scriptFile: req.file.originalname,
    } as any;

    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');

    logger.info('agent.controller: uploaded tool script', {
      agentId,
      toolId,
      scriptFile: req.file.originalname,
      size: req.file.size,
    });

    res.json({
      success: true,
      scriptFile: req.file.originalname,
      size: req.file.size,
      tool: cfg,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// Global Tools CRUD
// ============================================================

import { loadGlobalToolConfigs, getGlobalToolsDir, loadMcpServerConfigs, getMcpServersDir } from '../agents/global-tool-loader';
import { McpServerConfig, listMcpTools, closeMcpClient } from '../agents/mcp-client';

/**
 * GET /api/global-tools
 *
 * 列出所有全局 Tool 配置。
 */
export function listGlobalTools(_req: Request, res: Response, next: NextFunction): void {
  try {
    const configs = loadGlobalToolConfigs();
    res.json(configs);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/global-tools
 *
 * 创建新的全局 Tool。
 */
export function createGlobalTool(req: Request, res: Response, next: NextFunction): void {
  try {
    const globalToolsDir = getGlobalToolsDir();

    const { id, name, description, parameters, handler } = req.body;
    if (!id || !name || !description) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'id, name and description are required' });
      return;
    }
    if (!handler || !handler.type) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'handler with type is required' });
      return;
    }
    if (handler.type === 'http' && !handler.url) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'handler.url is required for http type' });
      return;
    }
    if (handler.type === 'script' && !handler.runtime) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'handler.runtime is required for script type' });
      return;
    }

    if (!fs.existsSync(globalToolsDir)) {
      fs.mkdirSync(globalToolsDir, { recursive: true });
    }

    const filePath = path.join(globalToolsDir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      res.status(409).json({ code: 'CONFLICT', message: `Global tool "${id}" already exists` });
      return;
    }

    const toolConfig: AgentToolConfig = {
      id,
      name,
      description,
      parameters: parameters || [],
      handler,
      enabled: true,
    };

    fs.writeFileSync(filePath, JSON.stringify(toolConfig, null, 2) + '\n', 'utf-8');

    logger.info('agent.controller: created global tool', { toolId: id });
    res.status(201).json({ success: true, tool: toolConfig });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/global-tools/:toolId
 *
 * 更新已有的全局 Tool 配置。
 */
export function updateGlobalTool(req: Request, res: Response, next: NextFunction): void {
  try {
    const globalToolsDir = getGlobalToolsDir();
    const toolId = paramStr(req.params.toolId);
    const filePath = path.join(globalToolsDir, `${toolId}.json`);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ code: 'NOT_FOUND', message: `Global tool "${toolId}" not found` });
      return;
    }

    // 读取现有配置并合并
    let existing: AgentToolConfig;
    try {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      existing = { id: toolId, name: toolId, description: '', parameters: [], handler: { type: 'http', url: '' } };
    }

    const { name, description, parameters, handler, enabled } = req.body;
    const merged: AgentToolConfig = {
      ...existing,
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(parameters !== undefined && { parameters }),
      ...(handler !== undefined && { handler }),
      ...(enabled !== undefined && { enabled }),
    };

    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');

    logger.info('agent.controller: updated global tool', { toolId });
    res.json({ success: true, tool: merged });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/global-tools/:toolId
 *
 * 删除指定的全局 Tool。
 */
export function deleteGlobalTool(req: Request, res: Response, next: NextFunction): void {
  try {
    const globalToolsDir = getGlobalToolsDir();
    const toolId = paramStr(req.params.toolId);
    const filePath = path.join(globalToolsDir, `${toolId}.json`);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ code: 'NOT_FOUND', message: `Global tool "${toolId}" not found` });
      return;
    }

    // 如果是 script 类型，同时删除脚本文件
    try {
      const cfg: AgentToolConfig = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (cfg.handler?.type === 'script' && cfg.handler.scriptFile) {
        const scriptPath = path.join(globalToolsDir, 'scripts', cfg.handler.scriptFile);
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
          logger.info('agent.controller: deleted global tool script', { toolId, scriptFile: cfg.handler.scriptFile });
        }
      }
    } catch { /* ignore parse errors */ }

    fs.unlinkSync(filePath);

    logger.info('agent.controller: deleted global tool', { toolId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// Global Tool Script Upload
// ============================================================

/** multer 中间件导出，供路由使用 */
export const globalScriptUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('script');

/**
 * POST /api/global-tools/:toolId/script
 *
 * 上传全局Tool脚本文件。
 */
export function uploadGlobalToolScript(req: Request, res: Response, next: NextFunction): void {
  try {
    const globalToolsDir = getGlobalToolsDir();
    const toolId = paramStr(req.params.toolId);
    const configPath = path.join(globalToolsDir, `${toolId}.json`);

    if (!fs.existsSync(configPath)) {
      res.status(404).json({ code: 'NOT_FOUND', message: `Global tool "${toolId}" not found` });
      return;
    }

    if (!req.file) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'No script file uploaded' });
      return;
    }

    // 确保 scripts 目录存在
    const scriptsDir = path.join(globalToolsDir, 'scripts');
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    // 写入脚本文件
    const scriptPath = path.join(scriptsDir, req.file.originalname);
    fs.writeFileSync(scriptPath, req.file.buffer);

    // 更新 JSON 配置中的 scriptFile
    let cfg: AgentToolConfig;
    try {
      cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      cfg = { id: toolId, name: toolId, description: '', parameters: [], handler: { type: 'script', scriptFile: '', runtime: 'node' } };
    }

    // 如果之前有旧脚本文件且文件名不同，删除旧文件
    if (cfg.handler.type === 'script' && cfg.handler.scriptFile && cfg.handler.scriptFile !== req.file.originalname) {
      const oldPath = path.join(scriptsDir, cfg.handler.scriptFile);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    cfg.handler = {
      ...cfg.handler,
      type: 'script',
      scriptFile: req.file.originalname,
    } as any;

    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');

    logger.info('agent.controller: uploaded global tool script', {
      toolId,
      scriptFile: req.file.originalname,
      size: req.file.size,
    });

    res.json({
      success: true,
      scriptFile: req.file.originalname,
      size: req.file.size,
      tool: cfg,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// MCP Server CRUD
// ============================================================

/**
 * GET /api/mcp-servers
 *
 * 列出所有 MCP Server 配置。
 */
export function listMcpServers(_req: Request, res: Response, next: NextFunction): void {
  try {
    const configs = loadMcpServerConfigs();
    res.json(configs);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/mcp-servers/:serverId/tools
 *
 * 列出指定 MCP Server 提供的工具。
 */
export async function getMcpServerTools(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const serverId = paramStr(req.params.serverId);
    const configs = loadMcpServerConfigs();
    const config = configs.find((c) => c.id === serverId);

    if (!config) {
      res.status(404).json({ code: 'NOT_FOUND', message: `MCP server "${serverId}" not found` });
      return;
    }

    if (config.enabled === false) {
      res.status(400).json({ code: 'DISABLED', message: `MCP server "${serverId}" is disabled` });
      return;
    }

    const tools = await listMcpTools(config);
    res.json(tools);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/mcp-servers
 *
 * 创建新的 MCP Server 配置。
 */
export function createMcpServer(req: Request, res: Response, next: NextFunction): void {
  try {
    const mcpServersDir = getMcpServersDir();

    const { id, type, command, args, env, url, headers, enabled } = req.body;
    const serverType = type || 'local';

    // 校验必填字段
    if (!id) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'id is required' });
      return;
    }
    if (serverType === 'local' && !command) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'command is required for local MCP server' });
      return;
    }
    if (serverType === 'remote' && !url) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'url is required for remote MCP server' });
      return;
    }

    if (!fs.existsSync(mcpServersDir)) {
      fs.mkdirSync(mcpServersDir, { recursive: true });
    }

    const filePath = path.join(mcpServersDir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      res.status(409).json({ code: 'CONFLICT', message: `MCP server "${id}" already exists` });
      return;
    }

    const serverConfig: McpServerConfig = {
      id,
      type: serverType,
      enabled: enabled !== false,
      // 本地 MCP Server 字段
      ...(serverType === 'local' && {
        command,
        args: args || [],
        env: env || {},
      }),
      // 远程 MCP Server 字段
      ...(serverType === 'remote' && {
        url,
        headers: headers || {},
      }),
    };

    fs.writeFileSync(filePath, JSON.stringify(serverConfig, null, 2) + '\n', 'utf-8');

    logger.info('agent.controller: created MCP server', { serverId: id });
    res.status(201).json({ success: true, server: serverConfig });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/mcp-servers/:serverId
 *
 * 更新已有的 MCP Server 配置。
 */
export async function updateMcpServer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const mcpServersDir = getMcpServersDir();
    const serverId = paramStr(req.params.serverId);
    const filePath = path.join(mcpServersDir, `${serverId}.json`);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ code: 'NOT_FOUND', message: `MCP server "${serverId}" not found` });
      return;
    }

    // 读取现有配置并合并
    let existing: McpServerConfig;
    try {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      existing = { id: serverId, type: 'local' };
    }

    const { type, command, args, env, url, headers, enabled } = req.body;
    const merged: McpServerConfig = {
      ...existing,
      ...(type !== undefined && { type }),
      ...(command !== undefined && { command }),
      ...(args !== undefined && { args }),
      ...(env !== undefined && { env }),
      ...(url !== undefined && { url }),
      ...(headers !== undefined && { headers }),
      ...(enabled !== undefined && { enabled }),
    };

    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');

    // 如果 MCP 客户端已连接，关闭连接以便下次使用新配置
    await closeMcpClient(serverId);

    logger.info('agent.controller: updated MCP server', { serverId });
    res.json({ success: true, server: merged });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/mcp-servers/:serverId
 *
 * 删除指定的 MCP Server 配置。
 */
export async function deleteMcpServer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const mcpServersDir = getMcpServersDir();
    const serverId = paramStr(req.params.serverId);
    const filePath = path.join(mcpServersDir, `${serverId}.json`);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ code: 'NOT_FOUND', message: `MCP server "${serverId}" not found` });
      return;
    }

    // 关闭 MCP 客户端连接
    await closeMcpClient(serverId);

    fs.unlinkSync(filePath);

    logger.info('agent.controller: deleted MCP server', { serverId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/mcp-servers/install
 *
 * 安装 npm 上的 MCP Server 包。
 * Body: { packageName: string, registry?: string }
 */
export async function installMcpPackage(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { spawn } = await import('child_process');

  try {
    const { packageName, registry } = req.body;

    if (!packageName || typeof packageName !== 'string') {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'packageName is required' });
      return;
    }

    // 安全校验：只允许合法的 npm 包名
    const validPackagePattern = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[\w.+-]+)?$/i;
    if (!validPackagePattern.test(packageName)) {
      res.status(400).json({ code: 'INVALID_PACKAGE', message: 'Invalid package name format' });
      return;
    }

    logger.info('agent.controller: installing MCP package', { packageName, registry });

    // 构建 npm install 命令参数
    const args = ['install', packageName, '--save'];
    if (registry) {
      args.push('--registry', registry);
    }

    // 在 backend 目录执行 npm install
    const backendDir = path.resolve(__dirname, '../..');
    const npmProcess = spawn('npm', args, {
      cwd: backendDir,
      shell: true,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    npmProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    npmProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    npmProcess.on('close', (code: number | null) => {
      if (code === 0) {
        logger.info('agent.controller: MCP package installed successfully', { packageName });
        res.json({
          success: true,
          packageName,
          message: 'Package installed successfully',
          stdout: stdout.trim(),
        });
      } else {
        logger.error('agent.controller: MCP package installation failed', { packageName, code, stderr });

        // 尝试从 stderr 中提取 npm log 文件路径并读取内容
        let npmLogContent: string | undefined;
        // npm 错误格式: "npm error A complete log of this run can be found in: C:\...\xxx.log"
        // 或者换行: "... can be found in:\n   C:\...\xxx.log"
        const combinedOutput = (stdout + '\n' + stderr);
        // 匹配 Windows 路径 (C:\...) 或 Unix 路径 (/...)
        const logPathMatch = combinedOutput.match(/A complete log of this run can be found in:?\s*([A-Za-z]:[\\\/][^\r\n]+\.log|\/[^\r\n]+\.log)/i);

        logger.debug('agent.controller: looking for npm log path', {
          matchFound: !!logPathMatch,
          extractedPath: logPathMatch?.[1]
        });

        if (logPathMatch) {
          const logPath = logPathMatch[1].trim();
          logger.debug('agent.controller: trying to read npm log', { logPath });
          try {
            if (fs.existsSync(logPath)) {
              npmLogContent = fs.readFileSync(logPath, 'utf-8');
              logger.debug('agent.controller: npm log read successfully', { size: npmLogContent.length });
              // 限制日志大小，避免返回过大内容
              if (npmLogContent.length > 50000) {
                npmLogContent = npmLogContent.slice(-50000);
                npmLogContent = '... (日志已截断，仅显示最后 50KB)\n\n' + npmLogContent;
              }
            } else {
              logger.warn('agent.controller: npm log file not found', { logPath });
            }
          } catch (logErr) {
            logger.warn('agent.controller: failed to read npm log', { logPath, error: logErr });
          }
        }

        // 返回 200 但 success: false，让前端能获取完整错误信息 (包括 npmLog)
        res.json({
          success: false,
          packageName,
          code: 'INSTALL_FAILED',
          message: `npm install failed with code ${code}`,
          stderr: stderr.trim(),
          npmLog: npmLogContent,
        });
      }
    });

    npmProcess.on('error', (err: Error) => {
      logger.error('agent.controller: failed to spawn npm', { error: err });
      res.status(500).json({
        code: 'SPAWN_ERROR',
        message: 'Failed to execute npm install',
        error: err.message,
      });
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/mcp-servers/packages
 *
 * 列出已安装的 MCP Server 相关包。
 */
export async function listInstalledMcpPackages(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const backendDir = path.resolve(__dirname, '../..');
    const packageJsonPath = path.join(backendDir, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      res.status(500).json({ code: 'NO_PACKAGE_JSON', message: 'package.json not found' });
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // 过滤出 MCP 相关的包（包名包含 mcp、modelcontextprotocol 等）
    const mcpPackages: Array<{ name: string; version: string }> = [];
    for (const [name, version] of Object.entries(deps)) {
      if (
        name.includes('mcp') ||
        name.includes('modelcontextprotocol') ||
        name.includes('server-') // 常见的 MCP server 命名
      ) {
        mcpPackages.push({ name, version: String(version) });
      }
    }

    res.json(mcpPackages);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/mcp-servers/probe-tools
 *
 * 探测已安装的 MCP 包提供的工具列表（临时启动并获取 tools）。
 */
export async function probeMcpPackageTools(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { packageName, args: customArgs } = req.body as { packageName: string; args?: string[] };

    if (!packageName) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'packageName is required' });
      return;
    }

    logger.info('agent.controller: probing MCP package tools', { packageName, customArgs });

    // 创建临时的 MCP Server 配置
    const tempConfig: McpServerConfig = {
      id: `__probe__${Date.now()}`,
      command: 'npx',
      args: ['-y', packageName, ...(customArgs || [])],
      enabled: true,
    };

    try {
      const tools = await listMcpTools(tempConfig);
      // 关闭临时连接
      await closeMcpClient(tempConfig.id);

      logger.info('agent.controller: probed tools from MCP package', {
        packageName,
        toolCount: tools.length,
        toolNames: tools.map(t => t.name),
      });

      res.json({
        success: true,
        packageName,
        tools,
      });
    } catch (probeErr) {
      // 确保关闭临时连接
      await closeMcpClient(tempConfig.id);

      logger.error('agent.controller: failed to probe MCP package tools', { packageName, error: probeErr });
      res.json({
        success: false,
        packageName,
        error: probeErr instanceof Error ? probeErr.message : String(probeErr),
        tools: [],
      });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/mcp-servers/test
 *
 * 测试 MCP Server 配置（可以是未保存的配置，也可以是已保存的）。
 * 成功时返回可用 tools 列表，失败时返回错误信息。
 */
export async function testMcpServer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { config } = req.body as { config: McpServerConfig };

    if (!config || !config.id) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'config with id is required' });
      return;
    }

    const serverType = config.type || 'local';
    if (serverType === 'local' && !config.command) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'command is required for local MCP server' });
      return;
    }
    if (serverType === 'remote' && !config.url) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'url is required for remote MCP server' });
      return;
    }

    logger.info('agent.controller: testing MCP server', { serverId: config.id, type: serverType });

    // 使用临时 ID 测试，避免覆盖现有连接
    const testConfig: McpServerConfig = {
      ...config,
      id: `__test__${config.id}__${Date.now()}`,
    };

    const testTime = new Date().toISOString();
    let testSuccess = false;
    let testError: string | undefined;
    let testTools: Array<{ name: string; description?: string }> = [];

    try {
      const tools = await listMcpTools(testConfig);
      testSuccess = true;
      testTools = tools.map(t => ({ name: t.name, description: t.description }));

      logger.info('agent.controller: MCP server test succeeded', {
        serverId: config.id,
        toolCount: tools.length,
      });
    } catch (err) {
      testSuccess = false;
      testError = err instanceof Error ? err.message : String(err);

      logger.error('agent.controller: MCP server test failed', {
        serverId: config.id,
        error: testError,
      });
    } finally {
      // 关闭测试连接
      await closeMcpClient(testConfig.id);
    }

    res.json({
      success: testSuccess,
      serverId: config.id,
      testTime,
      tools: testTools,
      error: testError,
    });
  } catch (err) {
    next(err);
  }
}
