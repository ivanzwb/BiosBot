/**
 * teacher-agent — 老师/讲解 Agent
 *
 * 职责：根据用户提供的题目或知识点进行讲解、推导步骤、举例说明。
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

const AGENT_ID = 'teacher-agent';

const SYSTEM_PROMPT = `你是一个耐心、专业的老师（teacher-agent），擅长：
- 对各类题目进行详细讲解，包括解题思路和步骤推导
- 用通俗易懂的方式解释复杂知识点
- 提供相关的举例说明和类比
- 引导学生思考，而不是直接给出答案

请根据用户的问题提供清晰、有条理的讲解。使用分步骤的方式展示推导过程。`;

async function run(input: AgentInput): Promise<AgentOutput> {
  const mapping = getConfigJSON<any>('agent_model_mapping');
  const agentCfg = mapping?.agents?.[AGENT_ID];
  const provider = agentCfg?.model?.provider || mapping?.defaultModel?.provider || 'openai';
  const model = agentCfg?.model?.model || mapping?.defaultModel?.model || 'gpt-4.1-mini';

  const keys = getConfigJSON<Record<string, string>>('api_keys');
  const apiKey = keys?.[provider] || process.env[`${provider.toUpperCase()}_API_KEY`] || '';

  if (!apiKey) {
    return { answer: '当前未配置 API Key，teacher-agent 无法工作。请在设置中添加对应大模型的 API Key。' };
  }

  try {
    const chat = createChatModel({
      provider,
      apiKey,
      model,
      temperature: input.options?.temperature ?? 0.5,
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
    logger.error('teacher-agent error', { error: err });
    return { answer: 'teacher-agent 处理时出现错误，请稍后重试。' };
  }
}

const agent: DomainAgent = {
  id: 'teacher-agent',
  name: '老师/讲解 Agent',
  description: '根据用户提供的题目或知识点进行讲解、推导步骤、举例说明，可配合 proxy-agent 完成复合教学任务。',
  skills: ['题目讲解', '知识点解释', '步骤推导', '举例说明'],
  run,
};

export default agent;
