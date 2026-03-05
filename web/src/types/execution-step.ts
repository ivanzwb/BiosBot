/** 执行步骤类型 */
export type StepType =
  | 'classify'      // 意图识别
  | 'route'         // 路由规划
  | 'agent_start'   // 开始调用领域Agent
  | 'agent_end'     // 领域Agent完成
  | 'aggregate'     // 聚合结果
  | 'direct_answer'; // 直接回答

/** 执行步骤信息 */
export interface ExecutionStep {
  stepType: StepType;
  agentId?: string;
  agentName?: string;
  description: string;
  status: 'running' | 'completed' | 'failed';
  detail?: unknown;
}
