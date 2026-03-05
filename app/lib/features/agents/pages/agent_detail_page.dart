import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../viewmodels/agents_viewmodel.dart';

/// Agent 详情页面 — 展示描述、技能、知识库状态
class AgentDetailPage extends StatefulWidget {
  final String agentId;
  const AgentDetailPage({super.key, required this.agentId});

  @override
  State<AgentDetailPage> createState() => _AgentDetailPageState();
}

class _AgentDetailPageState extends State<AgentDetailPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final vm = context.read<AgentsViewModel>();
      vm.loadAgents();
      vm.loadKnowledgeStatus(widget.agentId);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.agentId),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/agents'),
        ),
      ),
      body: Consumer<AgentsViewModel>(
        builder: (context, vm, _) {
          final agent = vm.agents
              .where((a) => a.id == widget.agentId)
              .firstOrNull;
          final knowledge = vm.getKnowledgeStatus(widget.agentId);

          if (agent == null && vm.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 基本信息卡片
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('基本信息',
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 12),
                        _InfoRow('ID', widget.agentId),
                        _InfoRow('名称', agent?.name ?? '-'),
                        _InfoRow('状态',
                            (agent?.enabled ?? false) ? '已启用' : '已禁用'),
                        _InfoRow('描述', agent?.description ?? '-'),
                        if (agent?.defaultModel != null) ...[
                          _InfoRow('模型供应商',
                              agent!.defaultModel!['provider']?.toString() ?? '-'),
                          _InfoRow('模型',
                              agent.defaultModel!['model']?.toString() ?? '-'),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                // 知识库状态卡片
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text('知识库',
                                style:
                                    Theme.of(context).textTheme.titleMedium),
                            const Spacer(),
                            TextButton.icon(
                              icon: const Icon(Icons.refresh, size: 18),
                              label: const Text('刷新'),
                              onPressed: () =>
                                  vm.loadKnowledgeStatus(widget.agentId),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        if (knowledge != null) ...[
                          _InfoRow('已初始化',
                              knowledge['initialized'] == true ? '是' : '否'),
                          _InfoRow('文件数量',
                              '${knowledge['fileCount'] ?? 0}'),
                        ] else
                          const Text('加载中...'),
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          icon: const Icon(Icons.delete_outline),
                          label: const Text('清空知识库'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor:
                                Theme.of(context).colorScheme.error,
                          ),
                          onPressed: () => _confirmClear(context, vm),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _confirmClear(BuildContext context, AgentsViewModel vm) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('确认清空'),
        content: Text('确定要清空 ${widget.agentId} 的知识库吗？此操作不可撤销。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              vm.clearKnowledge(widget.agentId);
              Navigator.pop(ctx);
            },
            child: const Text('确认清空'),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label,
                style: TextStyle(
                    color: Theme.of(context).colorScheme.outline)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
