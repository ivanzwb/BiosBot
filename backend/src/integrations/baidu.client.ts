import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface BaiduConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 百度（文心一言）Chat 模型工厂。
 * TODO: 接入 @langchain/community 中的百度适配器，或自行封装 HTTP 调用。
 */
export function createBaiduChat(_cfg: BaiduConfig): BaseChatModel {
  throw new Error('Baidu LLM integration not yet implemented. Please install the corresponding LangChain adapter.');
}
