/**
 * stock-agent — 金融/股票分析 Agent
 *
 * 职责：解析和分析财报、计算财务指标、结合 RAG 知识库给出投资解读。
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

// 加载本 Agent 的 Skill（Markdown 格式，元数据预加载，内容由 LLM 按需加载）
const mySkills = loadSkills(path.resolve(__dirname));

const AGENT_ID = 'stock-agent';

const SYSTEM_PROMPT = `你是一个专业的金融分析助手（stock-agent），擅长：
- 解析和分析财报数据
- 计算常见财务指标（PE、PB、ROE 等）
- 提供投资相关解读和风险提示

请基于用户的问题提供专业、准确的分析。如果信息不足，请说明需要哪些额外数据。
注意：你的回答仅供参考，不构成投资建议。`;

async function run(input: AgentInput): Promise<AgentOutput> {
  const mapping = getConfigJSON<any>('agent_model_mapping');
  const agentCfg = mapping?.agents?.[AGENT_ID];
  const provider = agentCfg?.model?.provider || mapping?.defaultModel?.provider || 'openai';
  const model = agentCfg?.model?.model || mapping?.defaultModel?.model || 'gpt-4.1-mini';

  // 获取 API Key
  const keys = getConfigJSON<Record<string, string>>('api_keys');
  const apiKey = keys?.[provider] || process.env[`${provider.toUpperCase()}_API_KEY`] || '';

  if (!apiKey) {
    return { answer: '当前未配置 API Key，stock-agent 无法工作。请在设置中添加对应大模型的 API Key。' };
  }

  try {
    const chat = createChatModel({
      provider,
      apiKey,
      model,
      temperature: input.options?.temperature ?? 0.3,
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
    logger.error('stock-agent error', { error: err });
    return { answer: 'stock-agent 处理时出现错误，请稍后重试。' };
  }
}

const agent: DomainAgent = {
  id: 'stock-agent',
  name: '股票分析 Agent',
  description: '面向股票/财报分析，解析和分析财报数据、计算常见财务指标（PE、PB、ROE 等）、结合 RAG 知识库给出投资相关解读和风险提示。',
  skills: ['财报分析', '财务指标计算', '投资解读', '风险提示'],
  run,
};

export default agent;
