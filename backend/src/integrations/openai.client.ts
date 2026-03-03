import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 创建 OpenAI Chat 模型实例。
 * apiKey 从数据库 configs 表获取，由调用方传入。
 */
export function createOpenAIChat(cfg: OpenAIConfig): BaseChatModel {
  return new ChatOpenAI({
    openAIApiKey: cfg.apiKey,
    modelName: cfg.model || 'gpt-4.1-mini',
    temperature: cfg.temperature ?? 0,
    maxTokens: cfg.maxTokens,
  }) as unknown as BaseChatModel;
}
