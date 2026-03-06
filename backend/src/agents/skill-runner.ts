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

/**
 * 清理 LLM 工具调用参数：移除空值（null、undefined、空字符串）。
 * LLM 经常为可选参数传入空字符串，会导致 Zod schema 校验失败
 * （例如 number 类型参数收到 "" 会在 LangChain 层抛出 ToolInputParsingException）。
 */
function cleanToolCallArgs(args: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(args)) {
    if (val === null || val === undefined || val === '') continue;
    cleaned[key] = val;
  }
  return cleaned;
}

/** tool-calling 最大轮次，防止无限循环 */
const MAX_TOOL_ROUNDS = 100;

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
  /**
   * 工具调用回调（用于实时推送工具执行状态）。
   */
  onToolCall?: (info: {
    toolName: string;
    args?: Record<string, unknown>;
    status: 'start' | 'end';
    result?: string;
  }) => void;
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
  const { chat, skills, systemPrompt, userMessage, extraTools = [], historyMessages = [], onToolCall } = options;

  // 收集所有工具
  const skillTools = createSkillTools(skills);
  const allTools: DynamicStructuredTool[] = [...skillTools, ...extraTools];

  // 调试日志
  logger.info('skill-runner: tools assembled', {
    skillTools: skillTools.length,
    extraTools: extraTools.length,
    totalTools: allTools.length,
    toolNames: allTools.map(t => t.name),
    hasOnToolCall: !!onToolCall,
  });

  // 无工具时直接调用
  if (allTools.length === 0) {
    logger.info('skill-runner: no tools available, calling LLM directly');
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
    logger.info('skill-runner: LLM response', {
      round,
      hasToolCalls: !!(toolCalls && toolCalls.length > 0),
      toolCallCount: toolCalls?.length || 0,
      toolNames: toolCalls?.map(tc => tc.name) || [],
    });
    if (!toolCalls || toolCalls.length === 0) {
      // 无 tool call → 最终回答
      return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    }

    // 执行每个 tool call，将结果作为 ToolMessage 追加
    for (const tc of toolCalls) {
      const tool = allTools.find((t) => t.name === tc.name);
      if (tool) {
        try {
          // 清理空值参数，防止 Zod 校验失败
          const cleanedArgs = cleanToolCallArgs(tc.args as Record<string, unknown>);
          // 通知工具开始执行
          logger.info('skill-runner: tool call start', { toolName: tc.name, args: cleanedArgs, hasCallback: !!onToolCall });
          if (onToolCall) {
            onToolCall({ toolName: tc.name, args: cleanedArgs, status: 'start' });
          }
          const result = await tool.invoke(cleanedArgs);
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
          messages.push(new ToolMessage({ content: resultStr, tool_call_id: tc.id! }));
          // 通知工具执行完成
          logger.debug('skill-runner: tool call end', { toolName: tc.name, hasCallback: !!onToolCall });
          if (onToolCall) {
            // 截断过长的结果
            const truncatedResult = resultStr.length > 200 ? resultStr.slice(0, 200) + '...' : resultStr;
            onToolCall({ toolName: tc.name, args: tc.args as Record<string, unknown>, status: 'end', result: truncatedResult });
          }
        } catch (err) {
          const errDetail = err instanceof Error ? err.message : String(err);
          logger.error(`skill-runner: tool "${tc.name}" failed`, { error: errDetail, stack: err instanceof Error ? err.stack : undefined });
          const errMsg = `工具 "${tc.name}" 调用失败: ${errDetail}`;
          messages.push(new ToolMessage({ content: errMsg, tool_call_id: tc.id! }));
          if (onToolCall) {
            onToolCall({ toolName: tc.name, args: tc.args as Record<string, unknown>, status: 'end', result: errMsg });
          }
        }
      } else {
        const errMsg = `未知工具: ${tc.name}`;
        messages.push(new ToolMessage({ content: errMsg, tool_call_id: tc.id! }));
        if (onToolCall) {
          onToolCall({ toolName: tc.name, status: 'end', result: errMsg });
        }
      }
    }

    logger.debug(`skill-runner: completed tool-call round ${round + 1}/${MAX_TOOL_ROUNDS}`);
  }

  // 超出最大轮次 — 强制让 LLM 给出总结性回答
  logger.warn('skill-runner: max tool-call rounds reached');

  // 添加一条系统消息，要求 LLM 基于已收集的信息给出回答
  messages.push(new HumanMessage(
    '你已经进行了多轮工具调用。现在请基于你从工具调用中获取的所有信息，直接给出最终的文字回答。不要再调用任何工具。'
  ));

  // 最后一次调用，不绑定工具，强制文本回复
  try {
    const finalResponse = await chat.invoke(messages);
    const content = typeof finalResponse.content === 'string'
      ? finalResponse.content
      : JSON.stringify(finalResponse.content);
    if (content && content.trim()) {
      return content;
    }
  } catch (err) {
    logger.error('skill-runner: failed to get final response after max rounds', { error: err });
  }

  // 如果仍然无法获取回答，尝试从最后的 AI 消息中提取内容
  const last = messages.filter((m) => m._getType() === 'ai').pop();
  if (last) {
    const content = typeof last.content === 'string' ? last.content : JSON.stringify(last.content);
    if (content && content.trim()) {
      return content;
    }
  }
  return '（工具调用次数达到上限，请尝试更简单的问题或重试）';
}
