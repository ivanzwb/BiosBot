/**
 * proxy-agent — 中枢代理 Agent
 *
 * 职责：意图识别、领域分类、多 Agent 工作流编排、结果聚合。
 * 入口：runProxyAgentWorkflow(request)
 */

import * as path from 'path';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createChatModel } from '../../integrations/llm.factory';
import { getConfigJSON } from '../../models/config.model';
import logger from '../../infra/logger/logger';
import {
  AgentInput,
  AgentOutput,
  ClassifyResult,
  DomainAgent,
  ProxyAgentRequest,
  ProxyAgentResult,
} from '../../types/agent.types';
import { Skill } from '../../types/skill.types';
import { loadSkills } from '../skill-loader';
import { runWithSkills } from '../skill-runner';
import { createRagTool, buildRagPrompt } from '../rag-tool';
import { hasKnowledge } from '../rag-service';
import { CLASSIFY_SYSTEM_PROMPT, CLASSIFY_USER_PROMPT } from './prompts/classify.prompt';
import { AGGREGATE_SYSTEM_PROMPT, AGGREGATE_USER_PROMPT } from './prompts/classify.prompt';

// ============================================================
// proxy-agent 自身的 Skill 加载
// ============================================================

let proxySkills: Skill[] = [];

/** 加载（或重新加载）proxy-agent 的 skills/ 目录 */
export function loadProxySkills(): Skill[] {
  proxySkills = loadSkills(path.resolve(__dirname));
  logger.info(`proxy-agent: loaded ${proxySkills.length} skill(s): [${proxySkills.map(s => s.id).join(', ')}]`);
  return proxySkills;
}

/** 获取 proxy-agent 已加载的 Skill 列表 */
export function getProxySkills(): Skill[] {
  return proxySkills;
}

// ============================================================
// 辅助：获取 LLM 配置（从数据库）
// ============================================================

interface AgentModelMapping {
  defaultModel: { provider: string; model: string };
  agents: Record<string, { enabled: boolean; model: { provider: string; model: string } }>;
}

function getAgentMapping(): AgentModelMapping | null {
  return getConfigJSON<AgentModelMapping>('agent_model_mapping');
}

function getApiKey(provider: string): string {
  const keys = getConfigJSON<Record<string, string>>('api_keys');
  if (keys && keys[provider]) return keys[provider];
  // 回退到环境变量（兼容开发阶段）
  const envKey = process.env[`${provider.toUpperCase()}_API_KEY`];
  return envKey || '';
}

// ============================================================
// 意图识别
// ============================================================

async function classifyIntent(input: AgentInput): Promise<ClassifyResult> {
  const mapping = getAgentMapping();
  const proxyConfig = mapping?.agents['proxy-agent'];
  const provider = proxyConfig?.model.provider || mapping?.defaultModel.provider || 'openai';
  const model = proxyConfig?.model.model || mapping?.defaultModel.model || 'gpt-4.1-mini';
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    logger.warn('No API key found for provider: ' + provider + '. Returning fallback classify result.');
    return { intent: 'chat', domains: [], confidence: 0.5 };
  }

  const chat = createChatModel({ provider, apiKey, model, temperature: 0 });

  // 构建可用 Agent 列表描述（优先使用注册表中的元数据）
  const registeredAgents = getRegisteredAgents();
  let enabledAgents: string;

  if (registeredAgents.length > 0) {
    enabledAgents = registeredAgents
      .filter((a) => {
        const cfg = mapping?.agents?.[a.id];
        return cfg?.enabled !== false; // 默认启用
      })
      .map((a) => {
        let desc = `- ${a.id}: ${a.description}`;
        // 展示 Agent 已加载的 Skill 描述，便于 LLM 更精准地路由
        if (a.loadedSkills && a.loadedSkills.length > 0) {
          desc += `\n  技能: ${a.loadedSkills.map(s => `${s.id}(${s.description})`).join('; ')}`;
        }
        return desc;
      })
      .join('\n');
  } else if (mapping?.agents) {
    enabledAgents = Object.entries(mapping.agents)
      .filter(([id, cfg]) => cfg.enabled && id !== 'proxy-agent')
      .map(([id]) => `- ${id}`)
      .join('\n');
  } else {
    enabledAgents = '- (暂无可用领域 Agent)';
  }

  const systemPrompt = CLASSIFY_SYSTEM_PROMPT.replace('{agentList}', enabledAgents);
  const userPrompt = CLASSIFY_USER_PROMPT.replace('{query}', input.query);

  try {
    const response = await chat.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    const raw = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    // 尝试提取 JSON
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as ClassifyResult;
      const domains = Array.isArray(parsed.domains) ? parsed.domains : [];

      // 解析 steps：校验格式，确保是合法的 string[][]
      let steps: string[][] | undefined;
      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        steps = parsed.steps
          .filter((s: unknown) => Array.isArray(s))
          .map((s: unknown[]) => (s as string[]).filter((id) => typeof id === 'string' && domains.includes(id)));
        // 过滤掉空步骤
        steps = steps.filter((s) => s.length > 0);
        if (steps.length === 0) steps = undefined;
      }

      return {
        intent: parsed.intent || 'chat',
        domains,
        steps,
        plan: parsed.plan || undefined,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      };
    }
  } catch (err) {
    logger.error('proxy-agent classify error', { error: err });
  }

  return { intent: 'chat', domains: [], confidence: 0.5 };
}

// ============================================================
// 调用领域 Agent
// ============================================================

/** 已注册的领域 Agent 映射（完整元数据 + 运行函数） */
const agentRegistry = new Map<string, DomainAgent>();

/** 注册一个领域 Agent（由 agent-discovery 自动调用） */
export function registerAgent(agent: DomainAgent): void {
  agentRegistry.set(agent.id, agent);
}

/** 获取所有已注册的领域 Agent 列表（供 controller / classify 使用） */
export function getRegisteredAgents(): DomainAgent[] {
  return Array.from(agentRegistry.values());
}

/** 清空 Agent 注册表（用于重新发现前重置） */
export function clearRegistry(): void {
  agentRegistry.clear();
}

async function invokeDomainAgent(agentId: string, input: AgentInput): Promise<AgentOutput> {
  const agent = agentRegistry.get(agentId);
  if (!agent) {
    return { answer: `Agent "${agentId}" 尚未实现或未注册。当前由通用代理 Agent 回答。` };
  }
  return agent.run({ ...input, id: agentId });
}

// ============================================================
// 通用对话（无匹配 Agent 时由 proxy-agent 自行回答）
// ============================================================

async function directAnswer(input: AgentInput): Promise<string> {
  const mapping = getAgentMapping();
  const proxyConfig = mapping?.agents['proxy-agent'];
  const provider = proxyConfig?.model.provider || 'openai';
  const model = proxyConfig?.model.model || 'gpt-4.1-mini';
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    return '抱歉，当前尚未配置 API Key，无法回答。请在设置中添加大模型 API Key。';
  }

  const chat = createChatModel({
    provider,
    apiKey,
    model,
    temperature: input.options?.temperature ?? 0.7,
    maxTokens: input.options?.maxTokens,
  });

  // 构建 RAG 工具（如果 proxy-agent 有知识库）
  const extraTools = [];
  const proxyDir = path.resolve(__dirname);
  const hasKB = await hasKnowledge('proxy-agent', proxyDir);
  if (hasKB) {
    extraTools.push(createRagTool({ agentId: 'proxy-agent', dataDir: proxyDir }));
  }

  const basePrompt = '你是一个通用智能助理，尽量简洁准确地回答用户问题。如果不确定，请坦诚说明。';
  const ragHint = hasKB ? `\n\n${buildRagPrompt('proxy-agent')}` : '';

  // 使用 Skill + RAG 增强的 LLM 调用
  return runWithSkills({
    chat,
    skills: proxySkills,
    systemPrompt: basePrompt + ragHint,
    userMessage: input.query,
    extraTools,
  });
}

// ============================================================
// 主入口：runProxyAgentWorkflow
// ============================================================

export async function runProxyAgentWorkflow(request: ProxyAgentRequest): Promise<ProxyAgentResult> {
  const { type, payload } = request;

  if (type === 'classify') {
    const classify = await classifyIntent(payload);
    return { classify };
  }

  // type === 'invoke'
  // 1. 先做意图识别
  const classify = await classifyIntent(payload);
  logger.info('proxy-agent classify result', { classify });

  // 2. 根据 domains 决定路由
  if (classify.domains.length === 0) {
    // 无匹配 Agent → proxy-agent 自行回答
    const answer = await directAnswer(payload);
    return { classify, answer };
  }

  // 3. 根据 steps 执行编排计划调用领域 Agent
  const steps = classify.steps || classify.domains.map((id) => [id]); // 无 steps 时默认全串行
  const agentOutputs: Array<{ agentId: string; output: AgentOutput }> = [];

  logger.info('proxy-agent: executing orchestration plan', {
    steps,
    plan: classify.plan,
  });

  for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
    const step = steps[stepIdx];

    // 构建带前序输出上下文的 payload（串行步骤间传递结果）
    const stepPayload: AgentInput = agentOutputs.length > 0
      ? {
          ...payload,
          context: {
            ...payload.context,
            previousOutputs: [...agentOutputs],
          },
        }
      : payload;

    if (step.length === 1) {
      // 单个 Agent — 直接执行
      const agentId = step[0];
      logger.info(`proxy-agent: step ${stepIdx + 1}/${steps.length} — run "${agentId}"`);
      const output = await invokeDomainAgent(agentId, stepPayload);
      agentOutputs.push({ agentId, output });
    } else {
      // 多 Agent — 并行执行（同一步骤内共享相同的前序上下文）
      logger.info(`proxy-agent: step ${stepIdx + 1}/${steps.length} — run [${step.join(', ')}] in parallel`);
      const results = await Promise.allSettled(
        step.map((agentId) => invokeDomainAgent(agentId, stepPayload))
      );
      for (let i = 0; i < step.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled') {
          agentOutputs.push({ agentId: step[i], output: r.value });
        } else {
          logger.error(`proxy-agent: agent "${step[i]}" failed in parallel step`, { error: r.reason });
          agentOutputs.push({
            agentId: step[i],
            output: { answer: `Agent "${step[i]}" 执行失败：${r.reason?.message || String(r.reason)}` },
          });
        }
      }
    }
  }

  // 4. 由 proxy-agent 检查、汇总、格式化各 Agent 输出（不扩展、不改变内容）
  const combinedAnswer = await aggregateOutputs(payload.query, agentOutputs);

  return { classify, answer: combinedAnswer, agentOutputs };
}

// ============================================================
// 结果聚合（LLM + Skill tool-calling 汇总，忠实于原始输出）
// ============================================================

/**
 * 将多个 Agent 的输出汇总为一份格式清晰的回复。
 * LLM 可按需调用 aggregate Skill 工具获取聚合指引。
 */
async function aggregateOutputs(
  query: string,
  outputs: Array<{ agentId: string; output: AgentOutput }>
): Promise<string> {
  // 如果只有一个 Agent 且输出正常，简单场景可直接返回
  if (outputs.length === 1 && outputs[0].output.answer) {
    return outputs[0].output.answer;
  }

  // 如果没有有效输出
  const validOutputs = outputs.filter((o) => o.output.answer);
  if (validOutputs.length === 0) {
    return '（各领域 Agent 均未产生有效回答）';
  }

  // 构建 Agent 结果文本
  const agentResults = validOutputs
    .map((o) => {
      const agentMeta = agentRegistry.get(o.agentId);
      const label = agentMeta ? `${agentMeta.name}（${o.agentId}）` : o.agentId;
      return `### ${label}\n${o.output.answer}`;
    })
    .join('\n\n');

  // 获取 LLM 配置
  const mapping = getAgentMapping();
  const proxyConfig = mapping?.agents['proxy-agent'];
  const provider = proxyConfig?.model.provider || mapping?.defaultModel.provider || 'openai';
  const model = proxyConfig?.model.model || mapping?.defaultModel.model || 'gpt-4.1-mini';
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    logger.warn('proxy-agent aggregate: no API key, falling back to simple join');
    return agentResults;
  }

  try {
    const chat = createChatModel({ provider, apiKey, model, temperature: 0 });
    const userPrompt = AGGREGATE_USER_PROMPT
      .replace('{query}', query)
      .replace('{agentResults}', agentResults);

    // 使用 Skill + RAG 增强的 LLM 调用（LLM 可调用 aggregate skill 获取聚合指引）
    const extraTools = [];
    const proxyDir = path.resolve(__dirname);
    const hasKB = await hasKnowledge('proxy-agent', proxyDir);
    if (hasKB) {
      extraTools.push(createRagTool({ agentId: 'proxy-agent', dataDir: proxyDir }));
    }

    return await runWithSkills({
      chat,
      skills: proxySkills,
      systemPrompt: AGGREGATE_SYSTEM_PROMPT,
      userMessage: userPrompt,
      extraTools,
    });
  } catch (err) {
    logger.error('proxy-agent aggregate error, falling back to simple join', { error: err });
    return agentResults;
  }
}
