/**
 * aggregation.service.ts — 响应聚合服务
 *
 * 当多 Agent 协作完成任务时，合并、去重、排序各 Agent 输出。
 */

import { AgentOutput } from '../types/agent.types';
import logger from '../infra/logger/logger';

export interface AggregatedResult {
  answer: string;
  reasoning?: string;
  sources: Array<{ agentId: string; answer: string }>;
}

/**
 * 聚合多个 Agent 的输出
 * 当前为简单拼接策略，后续可通过 LLM 做摘要聚合。
 */
export function aggregateOutputs(
  outputs: Array<{ agentId: string; output: AgentOutput }>
): AggregatedResult {
  if (outputs.length === 0) {
    return { answer: '未获取到任何 Agent 的回答。', sources: [] };
  }

  if (outputs.length === 1) {
    const { agentId, output } = outputs[0];
    return {
      answer: output.answer,
      reasoning: output.reasoning,
      sources: [{ agentId, answer: output.answer }],
    };
  }

  // 多 Agent：拼接各 Agent 回答，使用分隔线
  const parts: string[] = [];
  const sources: AggregatedResult['sources'] = [];

  for (const { agentId, output } of outputs) {
    parts.push(`**[${agentId}]**\n\n${output.answer}`);
    sources.push({ agentId, answer: output.answer });
  }

  const answer = parts.join('\n\n---\n\n');
  logger.info('aggregation.service: merged outputs from', {
    agents: outputs.map((o) => o.agentId),
  });

  return { answer, sources };
}
