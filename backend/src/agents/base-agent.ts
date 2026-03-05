/**
 * base-agent.ts — 所有 Agent 的公共基础设施
 *
 * 抽取 Domain Agent 和 proxy-agent 共享的底层逻辑：
 *  - 模型配置解析（agent_model_mapping + api_keys）
 *  - ChatModel 创建
 *  - RAG 工具构建
 *  - Skill + RAG 增强的 LLM 调用（对 runWithSkills 的标准化封装）
 *
 * domain-agent.ts 和 proxy-agent 均依赖此模块，避免重复代码。
 */

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Skill } from '../types/skill.types';
import { MessageRecord } from '../types/db.types';
import { createChatModel } from '../integrations/llm.factory';
import { getConfigJSON } from '../models/config.model';
import { runWithSkills } from './skill-runner';
import { createRagTool, buildRagPrompt } from './rag-tool';
import { hasKnowledge } from './rag-service';
import { loadAgentTools } from './tool-loader';
import { loadGlobalTools, loadMcpTools } from './global-tool-loader';
import logger from '../infra/logger/logger';

// ============================================================
// 模型配置解析
// ============================================================

export interface ModelConfig {
  model: string;
  apiKey: string;
  baseUrl: string;
}

/** 单条模型供应商配置（存储在 configs.models 数组中） */
export interface ModelProviderConfig {
  id: string;
  name: string;
  model: string;
  apiKey: string;
  baseUrl: string;
}

/**
 * 解析指定 Agent 的模型配置。
 *
 * 查找顺序：
 *  1. agent_model_mapping.agents[agentId].model  →  model config ID
 *  2. agent_model_mapping.defaultModel            →  model config ID
 *  3. 从 models 配置中按 ID 查找完整配置
 *  4. 兜底：env OPENAI_API_KEY / OPENAI_BASE_URL（不提供默认模型名）
 */
export function resolveModelConfig(agentId: string): ModelConfig {
  const mapping = getConfigJSON<any>('agent_model_mapping');
  const models = getConfigJSON<ModelProviderConfig[]>('models') || [];
  const agentCfg = mapping?.agents?.[agentId];
  const rawModel = agentCfg?.model || mapping?.defaultModel || '';
  // 兼容旧格式: { provider, model } → 取 model 字段
  const modelId = rawModel && typeof rawModel === 'object' ? (rawModel.model || rawModel.id || '') : rawModel;

  /** 确保 model 字段始终为 string */
  const ensureStr = (v: any): string => {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') return v.model || v.id || String(v);
    return String(v ?? '');
  };

  // 1. 按 ID 精确查找
  const byId = models.find(m => m.id === modelId);
  if (byId) {
    return {
      model: ensureStr(byId.model),
      apiKey: byId.apiKey || process.env.OPENAI_API_KEY || '',
      baseUrl: byId.baseUrl || process.env.OPENAI_BASE_URL || '',
    };
  }

  // 2. 按模型名称匹配（兼容 defaultModel 存的是字面模型名的情况）
  const byModel = modelId ? models.find(m => m.model === modelId) : undefined;
  if (byModel) {
    return {
      model: ensureStr(byModel.model),
      apiKey: byModel.apiKey || process.env.OPENAI_API_KEY || '',
      baseUrl: byModel.baseUrl || process.env.OPENAI_BASE_URL || '',
    };
  }

  // 3. 如果有任何已配置的模型，使用第一个作为凭据来源
  const fallbackEntry = models[0];
  if (fallbackEntry) {
    return {
      model: modelId || fallbackEntry.model,
      apiKey: fallbackEntry.apiKey || process.env.OPENAI_API_KEY || '',
      baseUrl: fallbackEntry.baseUrl || process.env.OPENAI_BASE_URL || '',
    };
  }

  // 4. 兜底：纯环境变量（不提供默认模型名，由用户在设置中配置）
  return {
    model: modelId || '',
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || '',
  };
}

// ============================================================
// ChatModel 创建
// ============================================================

export interface ChatModelOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * 为指定 Agent 创建 ChatModel 实例。
 * 自动从配置中读取 provider/model/apiKey。
 */
export function createAgentChat(agentId: string, options: ChatModelOptions = {}): {
  chat: BaseChatModel;
  config: ModelConfig;
} {
  const config = resolveModelConfig(agentId);
  const chat = createChatModel({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });
  return { chat, config };
}

// ============================================================
// RAG 工具构建
// ============================================================

export interface RagToolsResult {
  /** 需要传给 runWithSkills 的额外工具列表 */
  tools: DynamicStructuredTool[];
  /** 需要追加到 system prompt 的 RAG 提示文本（为空则无需追加） */
  ragHint: string;
}

/**
 * 为指定 Agent 构建 RAG 工具集。
 *
 * 检测知识库是否存在，存在则创建 query_knowledge 工具并生成 ragHint。
 * 不存在则返回空列表和空提示。
 */
export async function buildRagTools(agentId: string, agentDir: string): Promise<RagToolsResult> {
  const hasKB = await hasKnowledge(agentId, agentDir);
  if (!hasKB) {
    return { tools: [], ragHint: '' };
  }
  return {
    tools: [createRagTool({ agentId, dataDir: agentDir })],
    ragHint: `\n\n${buildRagPrompt(agentId)}`,
  };
}

// ============================================================
// 短期记忆：对话历史 → LangChain Messages
// ============================================================

/** 短期记忆默认保留的最大历史消息数 */
const DEFAULT_MAX_HISTORY = 20;

/**
 * 将 MessageRecord[] 转换为 LangChain BaseMessage[] 供 LLM 使用。
 *
 * - role: 'user'      → HumanMessage
 * - role: 'assistant' → AIMessage
 * - role: 'agent'     → AIMessage
 * - role: 'system'    → 跳过（system prompt 单独管理）
 *
 * 最多保留最近 maxMessages 条（截断旧消息）。
 */
export function convertHistoryToMessages(
  history: MessageRecord[],
  maxMessages: number = DEFAULT_MAX_HISTORY,
): BaseMessage[] {
  // 取最后 N 条
  const recent = history.slice(-maxMessages);
  const messages: BaseMessage[] = [];

  for (const msg of recent) {
    if (msg.role === 'user') {
      messages.push(new HumanMessage(msg.content));
    } else if (msg.role === 'assistant' || msg.role === 'agent') {
      messages.push(new AIMessage(msg.content));
    }
    // 'system' 角色跳过
  }

  return messages;
}

// ============================================================
// Skill + RAG 增强的标准化 LLM 调用
// ============================================================

export interface AgentRunOptions {
  /** Agent ID（用于日志和配置查找） */
  agentId: string;
  /** Agent 目录（用于 RAG 数据定位） */
  agentDir: string;
  /** 已加载的 Skill 列表 */
  skills: Skill[];
  /** 基础 System Prompt */
  systemPrompt: string;
  /** 用户消息 */
  userMessage: string;
  /** 默认 temperature */
  defaultTemperature?: number;
  /** 用户指定的 temperature（覆盖默认值） */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 静态额外工具（除 Skill 和 RAG 之外） */
  extraTools?: DynamicStructuredTool[];
  /** 短期记忆：对话历史消息（会被截断并转换为 LangChain 消息插入 LLM 上下文） */
  history?: MessageRecord[];
}

/**
 * 执行完整的 Agent 调用流程：
 *  1. 读取模型配置 → 创建 ChatModel
 *  2. 检测 RAG 知识库 → 构建 RAG 工具和 ragHint
 *  3. 调用 runWithSkills（Skill + RAG + extraTools 的 tool-calling 循环）
 *
 * @returns LLM 最终回复文本
 */
export async function runAgent(options: AgentRunOptions): Promise<string> {
  const {
    agentId,
    agentDir,
    skills,
    systemPrompt,
    userMessage,
    defaultTemperature = 0.5,
    temperature,
    maxTokens,
    extraTools: staticExtraTools = [],
    history = [],
  } = options;

  // 1. 读取模型配置
  const modelCfg = resolveModelConfig(agentId);
  if (!modelCfg.apiKey) {
    return `当前未配置 API Key，${agentId} 无法工作。请在设置中添加对应大模型的 API Key。`;
  }

  // 2. 创建 ChatModel
  const chat = createChatModel({
    apiKey: modelCfg.apiKey,
    baseUrl: modelCfg.baseUrl,
    model: modelCfg.model,
    temperature: temperature ?? defaultTemperature,
    maxTokens,
  });

  // 3. 构建 RAG 工具
  const rag = await buildRagTools(agentId, agentDir);

  // 4. 加载 Agent 目录下的自定义 Tools（tools/*.json）
  const { tools: agentTools } = loadAgentTools(agentDir);

  // 5. 加载全局Tools（所有 Agent 共享）
  const { tools: globalTools } = loadGlobalTools();

  // 6. 加载 MCP Server 提供的工具
  const mcpTools = await loadMcpTools();

  const extraTools: DynamicStructuredTool[] = [...staticExtraTools, ...rag.tools, ...agentTools, ...globalTools, ...mcpTools];

  // 调试日志：显示加载的工具
  logger.info(`base-agent: tools loaded for "${agentId}"`, {
    staticTools: staticExtraTools.length,
    ragTools: rag.tools.length,
    agentTools: agentTools.length,
    globalTools: globalTools.length,
    mcpTools: mcpTools.length,
    totalExtraTools: extraTools.length,
    mcpToolNames: mcpTools.map(t => t.name),
  });

  // 7. 转换历史消息为 LangChain 格式（短期记忆）
  const historyMessages = convertHistoryToMessages(history);

  // 8. 调用 runWithSkills
  return runWithSkills({
    chat,
    skills,
    systemPrompt: systemPrompt + rag.ragHint,
    userMessage,
    extraTools,
    historyMessages,
  });
}
