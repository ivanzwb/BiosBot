/**
 * domain-agent.ts — Domain Agent 工厂
 *
 * 将所有 Domain Agent 的公共逻辑（配置读取、Skill 加载、run 入口）
 * 抽象为 createDomainAgent 工厂函数。
 *
 * 底层 LLM 创建、RAG 工具构建、模型配置解析等公共逻辑
 * 由 base-agent.ts 提供，domain-agent.ts 只关注 Domain 层面的抽象。
 *
 * 两种使用方式：
 *  1. 纯配置驱动：目录下放 agent.json（+ 可选 prompt.md），由 agent-discovery
 *     调用 loadAgentConfig() 读取后传给 createDomainAgent()，零代码。
 *  2. 代码驱动：在 index.ts 中直接调用 createDomainAgent(config)。
 */

import * as fs from 'fs';
import * as path from 'path';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { AgentInput, AgentOutput, DomainAgent } from '../types/agent.types';
import { loadSkills } from './skill-loader';
import { runAgent } from './base-agent';
import logger from '../infra/logger/logger';

// ============================================================
// 配置类型
// ============================================================

import { McpServerConfig } from './mcp-client';

export interface DomainAgentConfig {
  /** Agent 唯一标识（与目录名一致，如 "stock-agent"） */
  id: string;
  /** Agent 显示名称 */
  name: string;
  /** Agent 功能描述（用于路由和 UI） */
  description: string;
  /** System Prompt（定义 Agent 人设和能力范围） */
  systemPrompt: string;
  /** 标签列表（UI 展示、路由辅助） */
  labels?: string[];
  /** 默认 temperature（用户未指定时使用），默认 0.5 */
  defaultTemperature?: number;
  /** Agent 源码目录（用于 Skill 加载和 RAG 数据定位），通常传 __dirname */
  agentDir: string;
  /**
   * 额外的自定义工具（除 Skill 和 RAG 外），
   * 会一起绑定到 ChatModel 上参与 tool-calling 循环。
   */
  extraTools?: DynamicStructuredTool[];
  /** Agent 专属的 MCP Server 配置（不与其他 Agent 共享） */
  mcpServers?: McpServerConfig[];
}

/**
 * agent.json 文件的结构（agentDir 和 extraTools 由代码注入，不在 JSON 中）。
 */
export interface AgentJsonConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt?: string;
  labels?: string[];
  defaultTemperature?: number;
}

// ============================================================
// 配置加载（纯 JSON 驱动，零代码创建 Agent）
// ============================================================

/**
 * 从 Agent 目录读取 agent.json 配置。
 *
 * - systemPrompt 来源优先级：
 *   1. 同目录下的 prompt.md 文件（适合长 Prompt）
 *   2. agent.json 中的 systemPrompt 字段
 *   3. 若都没有，使用默认 Prompt
 *
 * @returns DomainAgentConfig（含自动注入的 agentDir），若文件不存在返回 null
 */
export function loadAgentConfig(agentDir: string): DomainAgentConfig | null {
  const jsonPath = path.join(agentDir, 'agent.json');
  if (!fs.existsSync(jsonPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const json: AgentJsonConfig = JSON.parse(raw);

    if (!json.id || !json.name) {
      logger.warn(`base-agent: agent.json in "${agentDir}" missing required fields (id, name), skipped`);
      return null;
    }

    // 尝试从 prompt.md 读取 system prompt（优先于 agent.json 中的 systemPrompt）
    let systemPrompt = json.systemPrompt || '';
    const promptMdPath = path.join(agentDir, 'prompt.md');
    if (fs.existsSync(promptMdPath)) {
      try {
        systemPrompt = fs.readFileSync(promptMdPath, 'utf-8').trim();
      } catch (err) {
        logger.warn(`base-agent: failed to read prompt.md in "${agentDir}"`, { error: err });
      }
    }

    if (!systemPrompt) {
      systemPrompt = `你是 ${json.name}（${json.id}）。${json.description || ''}`;
    }

    return {
      id: json.id,
      name: json.name,
      description: json.description || '',
      systemPrompt,
      labels: json.labels,
      defaultTemperature: json.defaultTemperature,
      agentDir,
    };
  } catch (err) {
    logger.error(`base-agent: failed to parse agent.json in "${agentDir}"`, { error: err });
    return null;
  }
}

// ============================================================
// 工厂函数
// ============================================================

/**
 * 根据配置创建一个完整的 DomainAgent 实例。
 *
 * 自动处理：
 *  - Skill 扫描与加载（`skills/*.md`）
 *  - RAG 知识库检测与工具注入（`query_knowledge`）
 *  - 大模型配置读取（agent_model_mapping + api_keys）
 *  - tool-calling 循环执行（通过 runWithSkills）
 */
export function createDomainAgent(config: DomainAgentConfig): DomainAgent {
  const {
    id,
    name,
    description,
    systemPrompt,
    labels,
    defaultTemperature = 0.5,
    agentDir,
    extraTools: staticExtraTools = [],
    mcpServers = [],
  } = config;

  // 在模块加载时预扫描 Agent 目录下的 Skill 文件
  const mySkills = loadSkills(agentDir);

  async function run(input: AgentInput): Promise<AgentOutput> {
    try {
      const answer = await runAgent({
        agentId: id,
        agentDir,
        skills: mySkills,
        systemPrompt,
        userMessage: input.query,
        defaultTemperature,
        temperature: input.options?.temperature,
        maxTokens: input.options?.maxTokens,
        extraTools: staticExtraTools,
        history: input.context?.history,
        mcpServers,
      });
      return { answer };
    } catch (err) {
      logger.error(`${id} error`, { error: err });
      return { answer: `${id} 处理时出现错误，请稍后重试。` };
    }
  }

  return {
    id,
    name,
    description,
    labels,
    run,
  };
}
