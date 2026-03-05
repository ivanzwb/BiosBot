import { ExecutionStep } from '../types/execution-step';
import styles from './ExecutionStepsIndicator.module.css';

interface Props {
  steps: ExecutionStep[];
}

export default function ExecutionStepsIndicator({ steps }: Props) {
  if (steps.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>✨</span>
        <span>执行进度</span>
      </div>
      <div className={styles.stepList}>
        {steps.map((step, index) => (
          <div key={`${step.stepType}-${step.agentId ?? index}`} className={styles.step}>
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
        ))}
      </div>
    </div>
  );
}
