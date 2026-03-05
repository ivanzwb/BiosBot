import 'package:flutter/material.dart';
import '../../../models/execution_step.dart';

/// 执行步骤指示器组件 — 实时显示后端执行进度
class ExecutionStepsIndicator extends StatelessWidget {
  final List<ExecutionStep> steps;

  const ExecutionStepsIndicator({super.key, required this.steps});

  @override
  Widget build(BuildContext context) {
    if (steps.isEmpty) return const SizedBox.shrink();

    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withOpacity(0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: colorScheme.outline.withOpacity(0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(
                Icons.auto_awesome,
                size: 16,
                color: colorScheme.primary,
              ),
              const SizedBox(width: 6),
              Text(
                '执行进度',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...steps.map((step) => _StepItem(step: step)),
        ],
      ),
    );
  }
}

class _StepItem extends StatelessWidget {
  final ExecutionStep step;

  const _StepItem({required this.step});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          // 状态图标
          _buildStatusIcon(colorScheme),
          const SizedBox(width: 8),
          // 描述
          Expanded(
            child: Text(
              step.description,
              style: TextStyle(
                fontSize: 13,
                color: step.isRunning
                    ? colorScheme.onSurface
                    : colorScheme.onSurfaceVariant,
                fontWeight: step.isRunning ? FontWeight.w500 : FontWeight.normal,
              ),
            ),
          ),
          // Agent 名称标签（如果有）
          if (step.agentName != null) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: colorScheme.primaryContainer.withOpacity(0.6),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                step.agentName!,
                style: TextStyle(
                  fontSize: 11,
                  color: colorScheme.onPrimaryContainer,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatusIcon(ColorScheme colorScheme) {
    if (step.isRunning) {
      return SizedBox(
        width: 16,
        height: 16,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: colorScheme.primary,
        ),
      );
    } else if (step.isCompleted) {
      return Icon(
        Icons.check_circle,
        size: 16,
        color: colorScheme.primary,
      );
    } else if (step.isFailed) {
      return Icon(
        Icons.error,
        size: 16,
        color: colorScheme.error,
      );
    }
    return Icon(
      Icons.circle_outlined,
      size: 16,
      color: colorScheme.outline,
    );
  }
}
