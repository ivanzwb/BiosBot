import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 创建 OpenAI Chat 模型实例。
 * apiKey 从数据库 configs 表获取，由调用方传入。
 */
export function createOpenAIChat(cfg: OpenAIConfig): BaseChatModel {
  // 防御: model 必须是字符串，兼容旧 DB 中 { provider, model } 对象
  let modelName = cfg.model || '';
  if (typeof modelName !== 'string') {
    modelName = (modelName as any).model || (modelName as any).id || String(modelName);
  }
  if (!modelName) {
    throw new Error('未配置模型名称，请在「设置」页面添加模型配置。');
  }
  return new ChatOpenAI({
    openAIApiKey: cfg.apiKey,
    modelName,
    temperature: cfg.temperature ?? 0,
    maxTokens: cfg.maxTokens,
    ...(cfg.baseUrl ? { configuration: { baseURL: cfg.baseUrl } } : {}),
  }) as unknown as BaseChatModel;
}
