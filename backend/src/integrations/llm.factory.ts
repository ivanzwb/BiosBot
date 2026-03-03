/**
 * LLM 模型工厂 — 根据 provider 名称创建对应的 LangChain ChatModel 实例。
 * apiKey 和模型配置从数据库中获取后传入。
 */

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createOpenAIChat } from './openai.client';
import { createAliyunChat } from './aliyun.client';
import { createBaiduChat } from './baidu.client';

export interface LLMFactoryConfig {
  provider: string;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export function createChatModel(cfg: LLMFactoryConfig): BaseChatModel {
  switch (cfg.provider) {
    case 'openai':
      return createOpenAIChat({
        apiKey: cfg.apiKey,
        model: cfg.model,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
      });
    case 'aliyun':
      return createAliyunChat({
        apiKey: cfg.apiKey,
        model: cfg.model,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
      });
    case 'baidu':
      return createBaiduChat({
        apiKey: cfg.apiKey,
        model: cfg.model,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
      });
    default:
      throw new Error(`Unknown LLM provider: ${cfg.provider}`);
  }
}
