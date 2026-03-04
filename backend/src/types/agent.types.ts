import { MessageRecord } from './db.types';
import { Skill } from './skill.types';

// ============================================================
// Agent 通用输入 / 输出
// ============================================================

export interface AgentInput {
  id: string;
  conversationId: string;
  query: string;
  context?: {
    history?: MessageRecord[];
    extra?: Record<string, unknown>;
    /** 前置 Agent 的输出（串行编排时由 proxy-agent 自动注入，便于后续 Agent 引用前序结果） */
    previousOutputs?: Array<{ agentId: string; output: AgentOutput }>;
  };
  options?: {
    temperature?: number;
    maxTokens?: number;
  };
}

export interface AgentOutput {
  answer: string;
  reasoning?: string;
  usedDocs?: DocReference[];
  toolCalls?: ToolCallRecord[];
}

export interface DocReference {
  docId: string;
  title: string;
  snippet: string;
  score: number;
}

export interface ToolCallRecord {
  toolName: string;
  input: Record<string, unknown>;
  output: string;
}

// ============================================================
// 领域 Agent 接口 — 用于自动发现与注册
// ============================================================

/** 领域 Agent 统一接口，每个 Agent 的 index.ts 必须默认导出此类型实例 */
export interface DomainAgent {
  /** Agent 唯一标识，与目录名一致，如 "stock-agent" */
  id: string;
  /** Agent 显示名称 */
  name: string;
  /** Agent 功能描述（会展示给 proxy-agent 用于意图分类，以及前端 UI） */
  description: string;
  /** Agent 标签列表，便于路由匹配和 UI 展示 */
  labels?: string[];
  /**
   * 已加载的 Skill 列表（由 agent-discovery / skill-loader 自动扫描注入）。
   * 元数据（id, name, description）预加载供路由决策；内容作为 use_skill 工具由 LLM 按需加载。
   */
  loadedSkills?: Skill[];
  /**
   * Agent 源码所在目录的绝对路径（由 agent-discovery 自动注入，Agent 自身无需设置）。
   * 用于推导默认的 LanceDb 数据目录等与 Agent 物理位置相关的路径。
   */
  dataDir?: string;
  /** Agent 运行入口 */
  run: (input: AgentInput) => Promise<AgentOutput>;
}

// ============================================================
// proxy-agent 专用类型
// ============================================================

export interface ClassifyResult {
  intent: string;
  domains: string[];
  /**
   * 执行编排计划（由大模型生成）。
   * 是一个二维数组，表示“步骤”序列：
   *  - 外层数组的每个元素是一个“步骤”，步骤之间串行执行（前一步完成后才执行下一步）
   *  - 内层数组的 Agent 在同一步骤内并行执行
   *
   * 示例：
   *  - 全并行：       [["a", "b", "c"]]
   *  - 全串行：       [["a"], ["b"], ["c"]]
   *  - a 先，b+c 并行： [["a"], ["b", "c"]]
   *  - a+b 并行，然后 c： [["a", "b"], ["c"]]
   *
   * 若未提供或为空，则根据 domains 默认全串行。
   */
  steps?: string[][];
  /** 可选：执行计划说明（为什么这样编排） */
  plan?: string;
  confidence: number;
}

export interface ProxyAgentRequest {
  type: 'classify' | 'invoke';
  payload: AgentInput;
}

export interface ProxyAgentResult {
  classify?: ClassifyResult;
  answer?: string;
  agentOutputs?: Array<{ agentId: string; output: AgentOutput }>;
}
