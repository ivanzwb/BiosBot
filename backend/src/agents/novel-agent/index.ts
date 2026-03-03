/**
 * novel-agent — 小说/写作助手 Agent
 *
 * 职责：辅助用户进行小说创作，包括情节构思、角色设计、文风建议等。
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

const AGENT_ID = 'novel-agent';

const SYSTEM_PROMPT = `你是一个专业的小说创作助手（novel-agent），擅长：
- 根据用户的灵感帮助构思故事大纲和情节走向
- 设计立体、有层次的角色
- 提供不同文风（武侠、悬疑、言情、科幻等）的写作建议
- 帮助润色和改进已有的文段
- 分析经典作品的写作技巧

请根据用户的需求提供创意性的帮助，鼓励创作，同时给出专业建议。`;

async function run(input: AgentInput): Promise<AgentOutput> {
  const mapping = getConfigJSON<any>('agent_model_mapping');
  const agentCfg = mapping?.agents?.[AGENT_ID];
  const provider = agentCfg?.model?.provider || mapping?.defaultModel?.provider || 'openai';
  const model = agentCfg?.model?.model || mapping?.defaultModel?.model || 'gpt-4.1-mini';

  const keys = getConfigJSON<Record<string, string>>('api_keys');
  const apiKey = keys?.[provider] || process.env[`${provider.toUpperCase()}_API_KEY`] || '';

  if (!apiKey) {
    return { answer: '当前未配置 API Key，novel-agent 无法工作。请在设置中添加对应大模型的 API Key。' };
  }

  try {
    const chat = createChatModel({
      provider,
      apiKey,
      model,
      temperature: input.options?.temperature ?? 0.8,
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
    logger.error('novel-agent error', { error: err });
    return { answer: 'novel-agent 处理时出现错误，请稍后重试。' };
  }
}

const agent: DomainAgent = {
  id: 'novel-agent',
  name: '小说/创作 Agent',
  description: '辅助小说创作，包括情节构思、角色设计、文风建议、文段润色、经典作品分析等。',
  skills: ['情节构思', '角色设计', '文风建议', '文段润色', '写作技巧分析'],
  run,
};

export default agent;
