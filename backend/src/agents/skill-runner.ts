/**
 * skill-runner.ts — Skill + RAG 增强的 LLM 调用器
 *
 * 封装 LLM + tool-calling 循环：
 *  1. 将 Skill 元数据注入 system prompt
 *  2. 将 use_skill / query_knowledge 等工具绑定到 ChatModel
 *  3. 执行多轮 tool-call 循环，直到 LLM 给出最终回答
 *
 * 支持通过 extraTools 注入额外工具（如 RAG query_knowledge 工具），
 * 与 Skill 工具一起绑定到 ChatModel 上。
 */

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Skill } from '../types/skill.types';
import { buildSkillCatalog, createSkillTools } from './skill-tool';
import logger from '../infra/logger/logger';

/** tool-calling 最大轮次，防止无限循环 */
const MAX_TOOL_ROUNDS = 5;

export interface SkillRunnerOptions {
  /** LangChain ChatModel 实例 */
  chat: BaseChatModel;
  /** 可用的 Skill 列表 */
  skills: Skill[];
  /** 基础 system prompt（不含 Skill 信息） */
  systemPrompt: string;
  /** 用户消息 */
  userMessage: string;
  /**
   * 额外的 LangChain 工具（如 query_knowledge RAG 工具）。
   * 会与 use_skill 工具一起绑定到 ChatModel 上。
   */
  extraTools?: DynamicStructuredTool[];
  /**
   * 短期记忆：对话历史消息列表。
   * 插入到 system prompt 和当前 user message 之间，为 LLM 提供上下文。
   */
  historyMessages?: BaseMessage[];
}

/**
 * 使用 Skill + 额外工具 增强的方式调用 LLM。
 *
 * 流程：
 *  1. 在 system prompt 末尾追加 Skill 目录（元数据）
 *  2. 合并 use_skill 工具和 extraTools，绑定到 ChatModel
 *  3. 发送消息，若 LLM 返回 tool_calls 则执行工具并续传
 *  4. 重复直到 LLM 给出最终文本回复（或达到最大轮次）
 *
 * 若无可用 Skill 且无 extraTools，退化为普通 LLM 调用（无 tool binding）。
 */
export async function runWithSkills(options: SkillRunnerOptions): Promise<string> {
  const { chat, skills, systemPrompt, userMessage, extraTools = [], historyMessages = [] } = options;

  // 收集所有工具
  const skillTools = createSkillTools(skills);
  const allTools: DynamicStructuredTool[] = [...skillTools, ...extraTools];

  // 无工具时直接调用
  if (allTools.length === 0) {
    const response = await chat.invoke([
      new SystemMessage(systemPrompt),
      ...historyMessages,
      new HumanMessage(userMessage),
    ]);
    return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  }

  // 1. 构建带 Skill 目录的 system prompt
  const catalog = buildSkillCatalog(skills);
  const fullSystemPrompt = catalog
    ? `${systemPrompt}\n\n---\n${catalog}`
    : systemPrompt;

  // 2. 绑定工具
  const chatWithTools = chat.bindTools!(allTools);

  // 3. 初始消息（SystemMessage → 历史消息 → 当前 HumanMessage）
  const messages: BaseMessage[] = [
    new SystemMessage(fullSystemPrompt),
    ...historyMessages,
    new HumanMessage(userMessage),
  ];

  // 4. Tool-calling 循环
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await chatWithTools.invoke(messages);
    messages.push(response);

    // 检查是否有 tool_calls
    const toolCalls = (response as AIMessage).tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      // 无 tool call → 最终回答
      return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    }

    // 执行每个 tool call，将结果作为 ToolMessage 追加
    for (const tc of toolCalls) {
      const tool = allTools.find((t) => t.name === tc.name);
      if (tool) {
        try {
          const result = await tool.invoke(tc.args);
          messages.push(new ToolMessage({ content: result, tool_call_id: tc.id! }));
        } catch (err) {
          logger.error(`skill-runner: tool "${tc.name}" failed`, { error: err });
          messages.push(new ToolMessage({ content: `工具调用失败: ${err}`, tool_call_id: tc.id! }));
        }
      } else {
        messages.push(new ToolMessage({ content: `未知工具: ${tc.name}`, tool_call_id: tc.id! }));
      }
    }

    logger.debug(`skill-runner: completed tool-call round ${round + 1}/${MAX_TOOL_ROUNDS}`);
  }

  // 超出最大轮次 — 取最后一条 AI 消息的内容
  logger.warn('skill-runner: max tool-call rounds reached');
  const last = messages.filter((m) => m._getType() === 'ai').pop();
  if (last) {
    return typeof last.content === 'string' ? last.content : JSON.stringify(last.content);
  }
  return '（回答生成超时，请重试）';
}
