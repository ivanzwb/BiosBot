/**
 * movie-agent — 影视推荐/解析 Agent
 *
 * 职责：影视作品推荐、剧情解析、影评分析、演员/导演信息等。
 * 支持 Skill 工具（use_skill）和 RAG 知识库检索（query_knowledge）。
 */

import * as path from 'path';
import { AgentInput, AgentOutput, DomainAgent } from '../../types/agent.types';
import { createChatModel } from '../../integrations/llm.factory';
import { getConfigJSON } from '../../models/config.model';
import { loadSkills } from '../skill-loader';
import { runWithSkills } from '../skill-runner';
import { createRagTool, buildRagPrompt } from '../rag-tool';
import { hasKnowledge } from '../rag-service';
import logger from '../../infra/logger/logger';

// 加载本 Agent 的 Skill（如有）
const mySkills = loadSkills(path.resolve(__dirname));

const AGENT_ID = 'movie-agent';

const SYSTEM_PROMPT = `你是一个专业的影视助手（movie-agent），擅长：
- 根据用户口味推荐电影、电视剧、纪录片
- 深度解析剧情、主题和拍摄技巧
- 提供演员、导演的相关信息和代表作品
- 对比分析不同影视作品的优劣
- 根据用户描述的场景或心情推荐合适的影视作品

请提供有深度、有见解的影视内容分析和推荐。`;

async function run(input: AgentInput): Promise<AgentOutput> {
  const mapping = getConfigJSON<any>('agent_model_mapping');
  const agentCfg = mapping?.agents?.[AGENT_ID];
  const provider = agentCfg?.model?.provider || mapping?.defaultModel?.provider || 'openai';
  const model = agentCfg?.model?.model || mapping?.defaultModel?.model || 'gpt-4.1-mini';

  const keys = getConfigJSON<Record<string, string>>('api_keys');
  const apiKey = keys?.[provider] || process.env[`${provider.toUpperCase()}_API_KEY`] || '';

  if (!apiKey) {
    return { answer: '当前未配置 API Key，movie-agent 无法工作。请在设置中添加对应大模型的 API Key。' };
  }

  try {
    const chat = createChatModel({
      provider,
      apiKey,
      model,
      temperature: input.options?.temperature ?? 0.6,
      maxTokens: input.options?.maxTokens,
    });

    // 构建 RAG 工具（如果知识库存在）
    const extraTools = [];
    const agentDir = path.resolve(__dirname);
    const hasKB = await hasKnowledge(AGENT_ID, agentDir);
    if (hasKB) {
      extraTools.push(createRagTool({ agentId: AGENT_ID, dataDir: agentDir }));
    }

    // 动态追加 RAG 提示到 system prompt
    const ragHint = hasKB ? `\n\n${buildRagPrompt(AGENT_ID)}` : '';

    // 使用 Skill + RAG 增强的 LLM 调用
    const answer = await runWithSkills({
      chat,
      skills: mySkills,
      systemPrompt: SYSTEM_PROMPT + ragHint,
      userMessage: input.query,
      extraTools,
    });

    return { answer };
  } catch (err) {
    logger.error('movie-agent error', { error: err });
    return { answer: 'movie-agent 处理时出现错误，请稍后重试。' };
  }
}

const agent: DomainAgent = {
  id: 'movie-agent',
  name: '影视推荐/解析 Agent',
  description: '影视作品推荐、剧情解析、影评分析、演员/导演信息、根据心情推荐影视作品。',
  skills: ['影视推荐', '剧情解析', '影评分析', '演员导演信息'],
  run,
};

export default agent;
