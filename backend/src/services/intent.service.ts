/**
 * intent.service.ts — 意图识别服务
 *
 * 将 HTTP 请求转换为标准化输入，委托给 proxy-agent 完成意图识别。
 */

import { runProxyAgentWorkflow } from '../agents/proxy-agent';
import { ClassifyResult } from '../types/agent.types';
import * as ChatService from './chat.service';
import logger from '../infra/logger/logger';

export async function classifyIntent(
  query: string,
  conversationId: string
): Promise<ClassifyResult> {
  logger.info('intent.service: classifyIntent', { query, conversationId });

  // 加载对话历史（短期记忆），用于上下文感知的意图识别
  const history = ChatService.listMessages(conversationId);

  const result = await runProxyAgentWorkflow({
    type: 'classify',
    payload: {
      id: 'proxy-agent',
      conversationId,
      query,
      context: { history },
    },
  });

  return result.classify ?? { intent: 'chat', domains: [], confidence: 0.5 };
}
