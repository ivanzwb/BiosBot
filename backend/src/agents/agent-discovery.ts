/**
 * agent-discovery.ts — Agent 自动发现
 *
 * 扫描一个或多个目录下的子目录，自动加载每个 Agent 的 index.ts/js，
 * 读取其 default export（DomainAgent 接口实例）并注册到 proxy-agent 的 agentRegistry 中。
 *
 * 扫描目录优先级：
 *  1. config.agentDirs（通过环境变量 AGENT_DIRS 配置，逗号分隔）
 *  2. 若未配置，则使用内置的 agents/ 目录（即 __dirname）
 *
 * 约定：
 *  - 每个 Agent 位于 <dir>/<agent-id>/index.ts
 *  - 必须 default export 一个 DomainAgent 对象（含 id, name, description, run）
 *  - proxy-agent 目录不会被注册为领域 Agent
 */

import * as fs from 'fs';
import * as path from 'path';
import { registerAgent, clearRegistry } from './proxy-agent';
import { DomainAgent } from '../types/agent.types';
import { config } from '../config';
import logger from '../infra/logger/logger';
import { loadSkills } from './skill-loader';

/** 内置 Agent 目录（agents/） */
const BUILTIN_AGENTS_DIR = path.resolve(__dirname);

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
 */
function discoverInDir(dir: string, refresh: boolean): DomainAgent[] {
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
        agent.loadedSkills = loadSkills(agentDir);
        discovered.push(agent);
      } else {
        logger.warn(`agent-discovery: "${entry}" in "${dir}" does not export a valid DomainAgent, skipped`);
      }
    } catch (err) {
      logger.warn(`agent-discovery: failed to load "${entry}" in "${dir}"`, { error: err });
    }
  }

  return discovered;
}

/**
 * 扫描所有配置的目录，自动发现并注册领域 Agent。
 * 返回已注册的 DomainAgent 列表。
 */
export function discoverAndRegisterAgents(refresh = false): DomainAgent[] {
  if (refresh) {
    clearRegistry();
    logger.info('agent-discovery: registry cleared for refresh');
  }

  const dirs = getAgentDirs();
  logger.info(`agent-discovery: scanning ${dirs.length} director(ies): ${dirs.join(', ')}`);

  const registered: DomainAgent[] = [];
  const seenIds = new Set<string>();

  for (const dir of dirs) {
    const agents = discoverInDir(dir, refresh);
    for (const agent of agents) {
      if (seenIds.has(agent.id)) {
        logger.warn(`agent-discovery: duplicate agent id "${agent.id}" in "${dir}", skipped`);
        continue;
      }
      seenIds.add(agent.id);
      registerAgent(agent);
      registered.push(agent);
      logger.info(
        `agent-discovery: registered "${agent.id}" — ${agent.name}` +
          (agent.skills?.length ? ` [${agent.skills.join(', ')}]` : '') +
          (agent.loadedSkills?.length ? ` (${agent.loadedSkills.length} skill(s) loaded)` : '') +
          ` (from ${dir})`
      );
    }
  }

  return registered;
}
