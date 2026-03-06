import { ExecutionStep, ToolCallDetail } from '../types/execution-step';
import styles from './ExecutionStepsIndicator.module.css';

interface Props {
  steps: ExecutionStep[];
}

/** 格式化工具参数用于显示 */
function formatToolArgs(args?: Record<string, unknown>): string {
  if (!args) return '';
  // 提取关键参数（如文件路径、查询等）
  const keyArgs = ['path', 'file', 'query', 'directory', 'url', 'name'];
  for (const key of keyArgs) {
    if (args[key]) {
      const val = String(args[key]);
      return val.length > 50 ? val.slice(0, 50) + '...' : val;
    }
  }
  // 否则显示第一个参数
  const firstKey = Object.keys(args)[0];
  if (firstKey) {
    const val = String(args[firstKey]);
    return val.length > 50 ? val.slice(0, 50) + '...' : val;
  }
  return '';
}

export default function ExecutionStepsIndicator({ steps }: Props) {
  if (steps.length === 0) return null;

  // 分离 agent 步骤和 tool_call 步骤
  // tool_call 步骤会显示为最近一个 agent 的子项
  const mainSteps = steps.filter(s => s.stepType !== 'tool_call');
  const toolCalls = steps.filter(s => s.stepType === 'tool_call');

  // 按 agentId 分组 tool calls
  const toolCallsByAgent = new Map<string, ExecutionStep[]>();
  for (const tc of toolCalls) {
    const key = tc.agentId || '__no_agent__';
    if (!toolCallsByAgent.has(key)) {
      toolCallsByAgent.set(key, []);
    }
    toolCallsByAgent.get(key)!.push(tc);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>✨</span>
        <span>执行进度</span>
      </div>
      <div className={styles.stepList}>
        {mainSteps.map((step, index) => {
          // 对于 agent_start/agent_end/direct_answer 步骤，显示对应的工具调用
          const showToolCalls = step.stepType === 'agent_start' || step.stepType === 'agent_end' || step.stepType === 'direct_answer';
          // direct_answer 步骤的工具调用 agentId 为 'proxy-agent'
          const toolCallAgentId = step.stepType === 'direct_answer' ? 'proxy-agent' : (step.agentId || '');
          const agentToolCalls = showToolCalls
            ? toolCallsByAgent.get(toolCallAgentId) || []
            : [];
          // 只显示最近的工具调用（最多3个）
          const recentToolCalls = agentToolCalls.slice(-3);

          return (
            <div key={`${step.stepType}-${step.agentId ?? index}`}>
              <div className={styles.step}>
                <div className={styles.stepIcon}>
                  {step.status === 'running' && <div className={styles.spinner} />}
                  {step.status === 'completed' && <span className={styles.checkIcon}>✓</span>}
                  {step.status === 'failed' && <span className={styles.errorIcon}>✗</span>}
                </div>
                <span
                  className={`${styles.stepDescription} ${
                    step.status === 'running'
                      ? styles.stepDescriptionRunning
                      : step.status === 'completed'
                      ? styles.stepDescriptionCompleted
                      : styles.stepDescriptionFailed
                  }`}
                >
                  {step.description}
                </span>
                {step.agentName && <span className={styles.agentTag}>{step.agentName}</span>}
              </div>
              {/* 显示该 Agent 的工具调用 */}
              {recentToolCalls.length > 0 && (
                <div className={styles.toolCalls}>
                  {recentToolCalls.map((tc, tcIndex) => {
                    const detail = tc.detail as ToolCallDetail | undefined;
                    const argsStr = formatToolArgs(detail?.args);
                    return (
                      <div key={tcIndex} className={styles.toolCall}>
                        <span className={styles.toolCallIcon}>
                          {tc.status === 'running' ? '⚙️' : '✔️'}
                        </span>
                        <span className={styles.toolCallName}>{detail?.toolName || tc.description}</span>
                        {argsStr && <span className={styles.toolCallArgs}>{argsStr}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
