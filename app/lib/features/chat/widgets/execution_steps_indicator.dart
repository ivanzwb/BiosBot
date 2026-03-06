import 'package:flutter/material.dart';
import '../../../models/execution_step.dart';

/// 执行步骤指示器组件 — 实时显示后端执行进度
class ExecutionStepsIndicator extends StatelessWidget {
  final List<ExecutionStep> steps;

  const ExecutionStepsIndicator({super.key, required this.steps});

  /// 格式化工具参数用于显示
  String _formatToolArgs(Map<String, dynamic>? args) {
    if (args == null || args.isEmpty) return '';
    // 提取关键参数
    const keyArgs = ['path', 'file', 'query', 'directory', 'url', 'name'];
    for (final key in keyArgs) {
      if (args.containsKey(key)) {
        final val = args[key].toString();
        return val.length > 40 ? '${val.substring(0, 40)}...' : val;
      }
    }
    // 否则显示第一个参数
    final firstKey = args.keys.first;
    final val = args[firstKey].toString();
    return val.length > 40 ? '${val.substring(0, 40)}...' : val;
  }

  @override
  Widget build(BuildContext context) {
    if (steps.isEmpty) return const SizedBox.shrink();

    final colorScheme = Theme.of(context).colorScheme;

    // 分离主步骤和工具调用步骤
    final mainSteps = steps.where((s) => s.stepType != StepType.toolCall).toList();
    final toolCalls = steps.where((s) => s.stepType == StepType.toolCall).toList();

    // 按 agentId 分组工具调用
    final toolCallsByAgent = <String, List<ExecutionStep>>{};
    for (final tc in toolCalls) {
      final key = tc.agentId ?? '__no_agent__';
      toolCallsByAgent.putIfAbsent(key, () => []).add(tc);
    }

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
          ...mainSteps.map((step) {
            // 获取该 Agent 的工具调用（最多显示 3 个）
            // direct_answer 步骤的工具调用 agentId 为 'proxy-agent'
            final showToolCalls = step.stepType == StepType.agentStart ||
                step.stepType == StepType.agentEnd ||
                step.stepType == StepType.directAnswer;
            final toolCallAgentId = step.stepType == StepType.directAnswer ? 'proxy-agent' : step.agentId;
            final agentToolCalls = showToolCalls
                ? (toolCallsByAgent[toolCallAgentId] ?? []).reversed.take(3).toList().reversed.toList()
                : <ExecutionStep>[];

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _StepItem(step: step),
                // 显示该 Agent 的工具调用
                if (agentToolCalls.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(left: 24, top: 2, bottom: 4),
                    child: Container(
                      padding: const EdgeInsets.only(left: 8),
                      decoration: BoxDecoration(
                        border: Border(
                          left: BorderSide(
                            color: colorScheme.outline.withOpacity(0.3),
                            width: 2,
                          ),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: agentToolCalls.map((tc) {
                          final detail = tc.detail as Map<String, dynamic>?;
                          final toolName = detail?['toolName'] ?? tc.description;
                          final args = detail?['args'] as Map<String, dynamic>?;
                          final argsStr = _formatToolArgs(args);
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Row(
                              children: [
                                Text(
                                  tc.isRunning ? '⚙️' : '✔️',
                                  style: const TextStyle(fontSize: 10),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  toolName.toString(),
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    color: colorScheme.onSurface,
                                    fontFamily: 'monospace',
                                  ),
                                ),
                                if (argsStr.isNotEmpty) ...[
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      argsStr,
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: colorScheme.onSurfaceVariant,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
              ],
            );
          }),
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
