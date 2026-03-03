/**
 * router.service.ts — 路由调度服务
 *
 * 根据意图/领域标签选择对应 Agent，构建调用计划。
 * 只关心"调用哪个 Agent、以什么顺序"，不关心具体 Agent 内部实现。
 */

import { ClassifyResult } from '../types/agent.types';
import { getConfigJSON } from '../models/config.model';
import logger from '../infra/logger/logger';

export interface RoutePlan {
  /** 需要调用的 Agent ID 列表（按执行顺序） */
  agents: string[];
  /** 是否可并行执行 */
  parallel: boolean;
  /** 当没有匹配 Agent 时，由 proxy-agent 直接回答 */
  fallbackToProxy: boolean;
}

/**
 * 根据分类结果生成路由计划
 */
export function buildRoutePlan(classify: ClassifyResult): RoutePlan {
  // 如果没有匹配的领域 Agent，回退到 proxy-agent 直接回答
  if (!classify.domains || classify.domains.length === 0) {
    logger.info('router.service: no domain agents matched, fallback to proxy');
    return { agents: [], parallel: false, fallbackToProxy: true };
  }

  // 过滤出已启用的 Agent
  const mapping = getConfigJSON<any>('agent_model_mapping');
  const enabledAgents = classify.domains.filter((agentId) => {
    const cfg = mapping?.agents?.[agentId];
    return cfg?.enabled !== false; // 默认 enabled
  });

  if (enabledAgents.length === 0) {
    logger.warn('router.service: classified domains are all disabled', { domains: classify.domains });
    return { agents: [], parallel: false, fallbackToProxy: true };
  }

  // 单 Agent → 串行；多 Agent → 可并行（当前简化处理）
  const parallel = enabledAgents.length > 1;
  logger.info('router.service: route plan', { agents: enabledAgents, parallel });

  return { agents: enabledAgents, parallel, fallbackToProxy: false };
}
