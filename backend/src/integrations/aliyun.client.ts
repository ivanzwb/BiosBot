import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface AliyunConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 阿里云（通义千问）Chat 模型工厂。
 * TODO: 接入 @langchain/community 中的阿里云适配器，或自行封装 HTTP 调用。
 */
export function createAliyunChat(_cfg: AliyunConfig): BaseChatModel {
  throw new Error('Aliyun LLM integration not yet implemented. Please install the corresponding LangChain adapter.');
}
