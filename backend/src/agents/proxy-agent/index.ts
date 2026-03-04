/**
 * proxy-agent — 中枢代理 Agent
 *
 * 职责：意图识别、领域分类、多 Agent 工作流编排、结果聚合。
 * 入口：runProxyAgentWorkflow(request)
 */

import * as path from 'path';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createChatModel } from '../../integrations/llm.factory';
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
import { resolveModelConfig, buildRagTools, runAgent, convertHistoryToMessages } from '../base-agent';
import { getConfigJSON } from '../../models/config.model';
import { CLASSIFY_SYSTEM_PROMPT, CLASSIFY_USER_PROMPT } from './prompts/classify.prompt';
import { AGGREGATE_SYSTEM_PROMPT, AGGREGATE_USER_PROMPT } from './prompts/classify.prompt';

// ============================================================
// proxy-agent 自身的 Skill 加载
// ============================================================

/** 获取 proxy-agent 的目录绝对路径 */
export function getProxyAgentDir(): string {
  return path.resolve(__dirname);
}

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
// 意图识别
// ============================================================

async function classifyIntent(input: AgentInput): Promise<ClassifyResult> {
  const modelCfg = resolveModelConfig('proxy-agent');

  if (!modelCfg.apiKey) {
    logger.warn('No API key configured. Returning fallback classify result.');
    return { intent: 'chat', domains: [], confidence: 0.5 };
  }

  const chat = createChatModel({ apiKey: modelCfg.apiKey, baseUrl: modelCfg.baseUrl, model: modelCfg.model, temperature: 0 });

  // 构建可用 Agent 列表描述（优先使用注册表中的元数据）
  const registeredAgents = getRegisteredAgents();
  let enabledAgents: string;

  if (registeredAgents.length > 0) {
    enabledAgents = registeredAgents
      .filter((a) => {
        // 使用 resolveModelConfig 获取的 mapping 已内化在 base-agent 中
        // 这里只需基于注册表做简单过滤
        return true; // 已注册即已启用
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
  } else {
    enabledAgents = '- (暂无可用领域 Agent)';
  }

  // 从 agent_model_mapping 读取可配置的代理路由 System Prompt
  const cfgMapping = getConfigJSON<any>('agent_model_mapping');
  const classifyCfg = cfgMapping?.agents?.['proxy-agent'] || {};
  const classifyBase = (classifyCfg.classifyPrompt as string)?.trim() || CLASSIFY_SYSTEM_PROMPT;
  const systemPrompt = classifyBase.replace('{agentList}', enabledAgents);
  const userPrompt = CLASSIFY_USER_PROMPT.replace('{query}', input.query);

  try {
    const historyMessages = convertHistoryToMessages(input.context?.history || []);
    const response = await chat.invoke([
      new SystemMessage(systemPrompt),
      ...historyMessages,
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
  const proxyDir = path.resolve(__dirname);
  const defaultPrompt = '你是一个通用智能助理，尽量简洁准确地回答用户问题。如果不确定，请坦诚说明。';

  // 从 agent_model_mapping 读取可配置的 temperature
  const mapping = getConfigJSON<any>('agent_model_mapping');
  const proxyCfg = mapping?.agents?.['proxy-agent'] || {};
  const cfgTemperature = proxyCfg.temperature != null ? Number(proxyCfg.temperature) : 0.7;

  return runAgent({
    agentId: 'proxy-agent',
    agentDir: proxyDir,
    skills: proxySkills,
    systemPrompt: defaultPrompt,
    userMessage: input.query,
    defaultTemperature: cfgTemperature,
    temperature: input.options?.temperature,
    maxTokens: input.options?.maxTokens,
    history: input.context?.history,
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
  const modelCfg = resolveModelConfig('proxy-agent');

  if (!modelCfg.apiKey) {
    logger.warn('proxy-agent aggregate: no API key, falling back to simple join');
    return agentResults;
  }

  try {
    // 聚合阶段使用较低 temperature（默认0），可通过配置覆盖
    const agMapping = getConfigJSON<any>('agent_model_mapping');
    const pCfg = agMapping?.agents?.['proxy-agent'] || {};
    const aggTemp = pCfg.temperature != null ? Math.max(0, Number(pCfg.temperature) * 0.5) : 0;
    const chat = createChatModel({ apiKey: modelCfg.apiKey, baseUrl: modelCfg.baseUrl, model: modelCfg.model, temperature: aggTemp });
    const userPrompt = AGGREGATE_USER_PROMPT
      .replace('{query}', query)
      .replace('{agentResults}', agentResults);

    // 使用 Skill + RAG 增强的 LLM 调用（LLM 可调用 aggregate skill 获取聚合指引）
    const proxyDir = path.resolve(__dirname);
    const rag = await buildRagTools('proxy-agent', proxyDir);

    // 从 agent_model_mapping 读取可配置的内容聚合 System Prompt
    const aggregateBase = (pCfg.aggregatePrompt as string)?.trim() || AGGREGATE_SYSTEM_PROMPT;

    return await runWithSkills({
      chat,
      skills: proxySkills,
      systemPrompt: aggregateBase + rag.ragHint,
      userMessage: userPrompt,
      extraTools: rag.tools,
    });
  } catch (err) {
    logger.error('proxy-agent aggregate error, falling back to simple join', { error: err });
    return agentResults;
  }
}
