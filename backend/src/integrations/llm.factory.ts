/**
 * LLM 模型工厂 — 创建 OpenAI-compatible 的 LangChain ChatModel 实例。
 * 主流模型提供商（OpenAI、阿里云、深度求索、月之暗面等）均兼容 OpenAI API，
 * 通过 baseUrl 指向不同端点即可。
 */

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createOpenAIChat } from './openai.client';

export interface LLMFactoryConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export function createChatModel(cfg: LLMFactoryConfig): BaseChatModel {
  return createOpenAIChat({
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
  });
}
