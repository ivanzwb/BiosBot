/**
 * agent-discovery.ts — Agent 自动发现 + DB Agent 注册
 *
 * 两种来源：
 *  1. 数据库（domain_agents 配置）：由用户在 UI 中创建的 Domain Agent
 *  2. 文件系统扫描：backend/agents/ 下的 agent.json 或 index.ts（向后兼容）
 *
 * DB Agent 优先级高于文件系统发现，相同 id 的文件系统 Agent 会被跳过。
 */

import * as fs from 'fs';
import * as path from 'path';
import { registerAgent, clearRegistry } from './proxy-agent';
import { DomainAgent } from '../types/agent.types';
import { config } from '../config';
import logger from '../infra/logger/logger';
import { loadSkills } from './skill-loader';
import { loadAgentConfig, createDomainAgent, DomainAgentConfig } from './domain-agent';
import { getConfigJSON } from '../models/config.model';
import { McpServerConfig } from './mcp-client';

/** DB 中存储的 Agent 配置结构 */
export interface DbAgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt?: string;
  labels?: string[];
  defaultTemperature?: number;
  /** Agent 专属的 MCP Server 配置（不与其他 Agent 共享） */
  mcpServers?: McpServerConfig[];
}

/** 内置 Agent 目录（backend/agents/）— 存放纯配置驱动的 Domain Agent */
const BUILTIN_AGENTS_DIR = path.resolve(__dirname, '../../agents');

/** 需要跳过的目录名（不论在哪个扫描目录下都跳过） */
const SKIP_DIRS = new Set(['proxy-agent']);

/**
 * 获取生效的 Agent 扫描目录列表。
 * 外部配置的目录 + 内置 agents/ 目录（去重）。
 */
function getAgentDirs(): string[] {
  const dirs: string[] = [];
  const seen = new Set<string>();

  // 优先使用配置的目录
  for (const d of config.agentDirs) {
    const abs = path.resolve(d);
    if (!seen.has(abs)) {
      seen.add(abs);
      dirs.push(abs);
    }
  }

  // 始终包含内置 agents/ 目录
  if (!seen.has(BUILTIN_AGENTS_DIR)) {
    dirs.push(BUILTIN_AGENTS_DIR);
  }

  return dirs;
}

/**
 * 扫描单个目录下的子目录，发现并加载 DomainAgent。
 *
 * 对每个子目录：
 *  1. 优先检查 agent.json → 配置驱动，调用 createDomainAgent 自动创建（零代码）
 *  2. 否则检查 index.ts/js → 代码驱动，require 其 default export（自定义逻辑）
 *  3. 都不存在则跳过
 */
async function discoverInDir(dir: string, refresh: boolean): Promise<DomainAgent[]> {
  const discovered: DomainAgent[] = [];

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    logger.error(`agent-discovery: failed to read directory "${dir}"`, { error: err });
    return discovered;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;

    const agentDir = path.join(dir, entry);
    try {
      if (!fs.statSync(agentDir).isDirectory()) continue;
    } catch {
      continue;
    }

    // ---------- 模式 1：配置驱动（agent.json） ----------
    const agentConfig = loadAgentConfig(agentDir);
    if (agentConfig) {
      try {
        const agent = createDomainAgent(agentConfig);
        // 注入 dataDir 和 loadedSkills（与代码驱动保持一致）
        agent.dataDir = agentDir;
        agent.loadedSkills = await loadSkills(agentDir);
        discovered.push(agent);
        logger.debug(`agent-discovery: "${entry}" loaded via agent.json`);
        continue;
      } catch (err) {
        logger.warn(`agent-discovery: failed to create agent from agent.json in "${agentDir}"`, { error: err });
        // 回退到代码驱动模式
      }
    }

    // ---------- 模式 2：代码驱动（index.ts/js） ----------
    const indexPath = path.join(agentDir, 'index');
    try {
      // 刷新时清除 require 缓存，以便加载最新代码
      if (refresh) {
        const resolved = require.resolve(indexPath);
        delete require.cache[resolved];
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(indexPath);

      const agent: DomainAgent | undefined = mod.default || mod;

      if (agent && typeof agent.run === 'function' && agent.id && agent.name) {
        // 自动注入 Agent 源码目录路径，用于推导 LanceDb 等数据目录
        agent.dataDir = agentDir;
        // 自动加载 Agent 的 skills/ 子目录中定义的 Skill（Markdown 格式）
        agent.loadedSkills = await loadSkills(agentDir);
        discovered.push(agent);
        logger.debug(`agent-discovery: "${entry}" loaded via index.ts`);
      } else {
        logger.warn(`agent-discovery: "${entry}" in "${dir}" does not export a valid DomainAgent, skipped`);
      }
    } catch (err) {
      // 如果既没有 agent.json 也没有有效的 index.ts，跳过
      if (!agentConfig) {
        logger.debug(`agent-discovery: "${entry}" in "${dir}" has no agent.json or index.ts, skipped`);
      } else {
        logger.warn(`agent-discovery: failed to load "${entry}" in "${dir}"`, { error: err });
      }
    }
  }

  return discovered;
}

/**
 * 从数据库加载用户创建的 Domain Agent 并创建实例。
 */
async function loadDbAgents(): Promise<DomainAgent[]> {
  const agents: DomainAgent[] = [];
  const dbAgents = getConfigJSON<DbAgentConfig[]>('domain_agents') || [];

  for (const cfg of dbAgents) {
    if (!cfg.id || !cfg.name) continue;
    try {
      // DB Agent 的 agentDir 指向 BUILTIN_AGENTS_DIR/<id>（按需创建）
      const agentDir = path.join(BUILTIN_AGENTS_DIR, cfg.id);
      if (!fs.existsSync(agentDir)) {
        fs.mkdirSync(agentDir, { recursive: true });
      }

      const systemPrompt = cfg.systemPrompt || `你是 ${cfg.name}（${cfg.id}）。${cfg.description || ''}`;
      const domainConfig: DomainAgentConfig = {
        id: cfg.id,
        name: cfg.name,
        description: cfg.description || '',
        systemPrompt,
        labels: cfg.labels,
        defaultTemperature: cfg.defaultTemperature,
        agentDir,
        mcpServers: cfg.mcpServers,
      };

      const agent = createDomainAgent(domainConfig);
      agent.dataDir = agentDir;
      agent.loadedSkills = await loadSkills(agentDir);
      agents.push(agent);
      logger.debug(`agent-discovery: "${cfg.id}" loaded from DB`);
    } catch (err) {
      logger.warn(`agent-discovery: failed to create agent from DB config "${cfg.id}"`, { error: err });
    }
  }

  return agents;
}

/**
 * 扫描所有配置的目录，自动发现并注册领域 Agent。
 * DB 中的 Agent 优先注册，文件系统中同 id 的会被跳过。
 * 返回已注册的 DomainAgent 列表。
 */
export async function discoverAndRegisterAgents(refresh = false): Promise<DomainAgent[]> {
  if (refresh) {
    clearRegistry();
    logger.info('agent-discovery: registry cleared for refresh');
  }

  const registered: DomainAgent[] = [];
  const seenIds = new Set<string>();

  // ===== 优先加载 DB Agent =====
  const dbAgents = await loadDbAgents();
  for (const agent of dbAgents) {
    if (seenIds.has(agent.id)) continue;
    seenIds.add(agent.id);
    registerAgent(agent);
    registered.push(agent);
    logger.info(
      `agent-discovery: registered "${agent.id}" — ${agent.name} (from DB)` +
        (agent.labels?.length ? ` [${agent.labels.join(', ')}]` : '')
    );
  }

  // ===== 然后扫描文件系统 =====
  const dirs = getAgentDirs();
  logger.info(`agent-discovery: scanning ${dirs.length} director(ies): ${dirs.join(', ')}`);

  for (const dir of dirs) {
    const agents = await discoverInDir(dir, refresh);
    for (const agent of agents) {
      if (seenIds.has(agent.id)) {
        logger.debug(`agent-discovery: "${agent.id}" already registered from DB, skip file-based`);
        continue;
      }
      seenIds.add(agent.id);
      registerAgent(agent);
      registered.push(agent);
      logger.info(
        `agent-discovery: registered "${agent.id}" — ${agent.name}` +
          (agent.labels?.length ? ` [${agent.labels.join(', ')}]` : '') +
          (agent.loadedSkills?.length ? ` (${agent.loadedSkills.length} skill(s) loaded)` : '') +
          ` (from ${dir})`
      );
    }
  }

  return registered;
}
