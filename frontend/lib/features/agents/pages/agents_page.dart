import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../viewmodels/agents_viewmodel.dart';

/// Agent 列表管理页面
class AgentsPage extends StatefulWidget {
  const AgentsPage({super.key});

  @override
  State<AgentsPage> createState() => _AgentsPageState();
}

class _AgentsPageState extends State<AgentsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AgentsViewModel>().loadAgents();
    });
  }

  void _showCreateDialog() {
    final idCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final labelsCtrl = TextEditingController();
    double temperature = 0.5;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('新建 Domain Agent'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: idCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Agent ID *',
                    hintText: '如 travel-agent（小写字母、数字、连字符）',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(
                    labelText: '名称 *',
                    hintText: 'Agent 显示名称',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(
                    labelText: '描述',
                    hintText: 'Agent 的功能描述',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: labelsCtrl,
                  decoration: const InputDecoration(
                    labelText: '标签',
                    hintText: '用逗号分隔，如：推荐, 解析, 分析',
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Text('Temperature'),
                    Expanded(
                      child: Slider(
                        value: temperature,
                        min: 0,
                        max: 1,
                        divisions: 10,
                        label: temperature.toStringAsFixed(1),
                        onChanged: (v) =>
                            setDialogState(() => temperature = v),
                      ),
                    ),
                    Text(temperature.toStringAsFixed(1)),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: () async {
                if (idCtrl.text.trim().isEmpty || nameCtrl.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('ID 和名称不能为空')),
                  );
                  return;
                }
                final vm = context.read<AgentsViewModel>();
                final labels = labelsCtrl.text
                    .split(RegExp(r'[,，]'))
                    .map((s) => s.trim())
                    .where((s) => s.isNotEmpty)
                    .toList();
                final ok = await vm.createAgent(
                  id: idCtrl.text.trim(),
                  name: nameCtrl.text.trim(),
                  description: descCtrl.text.trim(),
                  labels: labels,
                  defaultTemperature: temperature,
                );
                if (ok && ctx.mounted) Navigator.pop(ctx);
              },
              child: const Text('创建'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AgentsViewModel>(
      builder: (context, vm, _) {
        return Scaffold(
          appBar: AppBar(
            automaticallyImplyLeading: false,
            title: const Text('Agents'),
            actions: [
              IconButton(
                icon: const Icon(Icons.add),
                tooltip: '添加 Agent',
                onPressed: _showCreateDialog,
              ),
              IconButton(
                icon: vm.isRefreshing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh),
                tooltip: '刷新',
                onPressed: vm.isRefreshing ? null : () => vm.refreshAgents(),
              ),
            ],
          ),
          body: _buildBody(context, vm),
        );
      },
    );
  }

  Widget _buildBody(BuildContext context, AgentsViewModel vm) {
    if (vm.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (vm.agents.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.smart_toy_outlined,
                size: 64, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 16),
            const Text('暂无可用 Agent'),
            const SizedBox(height: 16),
            FilledButton.icon(
              icon: const Icon(Icons.add),
              label: const Text('添加 Agent'),
              onPressed: _showCreateDialog,
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: vm.agents.length,
      itemBuilder: (context, index) {
        final agent = vm.agents[index];
        return Card(
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => context.push('/agents/${agent.id}/config'),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundColor: agent.enabled
                            ? Theme.of(context).colorScheme.primaryContainer
                            : Theme.of(context)
                                .colorScheme
                                .surfaceContainerHighest,
                        child: Icon(
                          _iconForAgent(agent.id),
                          size: 20,
                          color: agent.enabled
                              ? Theme.of(context)
                                  .colorScheme
                                  .onPrimaryContainer
                              : Theme.of(context).colorScheme.outline,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(agent.name,
                                style: Theme.of(context)
                                    .textTheme
                                    .titleSmall),
                            if (agent.description.isNotEmpty)
                              Text(
                                agent.description,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .outline,
                                    ),
                              ),
                          ],
                        ),
                      ),
                      // 状态 badge
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: agent.enabled
                              ? Theme.of(context)
                                  .colorScheme
                                  .primaryContainer
                              : Theme.of(context)
                                  .colorScheme
                                  .surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          agent.enabled ? '已启用' : '已禁用',
                          style: TextStyle(
                            fontSize: 11,
                            color: agent.enabled
                                ? Theme.of(context).colorScheme.primary
                                : Theme.of(context).colorScheme.outline,
                          ),
                        ),
                      ),
                      if (agent.source == 'db')
                        IconButton(
                          icon: Icon(Icons.delete_outline,
                              size: 20,
                              color: Theme.of(context).colorScheme.error),
                          onPressed: () => _confirmDelete(context, vm, agent),
                        ),
                    ],
                  ),
                  if (agent.labels.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      children: agent.labels
                          .map((l) => Chip(
                                label: Text(l, style: const TextStyle(fontSize: 11)),
                                materialTapTargetSize:
                                    MaterialTapTargetSize.shrinkWrap,
                                padding: EdgeInsets.zero,
                                visualDensity: VisualDensity.compact,
                              ))
                          .toList(),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      if (agent.model != null)
                        Text(
                          agent.model!,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: Theme.of(context).colorScheme.outline,
                              ),
                        ),
                      const Spacer(),
                      if (agent.source != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            border: Border.all(
                                color: Theme.of(context).colorScheme.outline,
                                width: 0.5),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            agent.source == 'db' ? '动态' : '内置',
                            style: TextStyle(
                              fontSize: 10,
                              color: Theme.of(context).colorScheme.outline,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _confirmDelete(
      BuildContext context, AgentsViewModel vm, Agent agent) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('确认删除'),
        content: Text('确定删除 Agent "${agent.name}" 吗？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            onPressed: () {
              vm.deleteAgent(agent.id);
              Navigator.pop(ctx);
            },
            child: const Text('删除'),
          ),
        ],
      ),
    );
  }

  IconData _iconForAgent(String id) {
    switch (id) {
      case 'proxy-agent':
        return Icons.hub;
      case 'stock-agent':
        return Icons.trending_up;
      case 'teacher-agent':
        return Icons.school;
      case 'novel-agent':
        return Icons.auto_stories;
      case 'movie-agent':
        return Icons.movie;
      default:
        return Icons.smart_toy;
    }
  }
}
