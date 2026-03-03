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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Agent 管理'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/chat'),
        ),
      ),
      body: Consumer<AgentsViewModel>(
        builder: (context, vm, _) {
          if (vm.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (vm.agents.isEmpty) {
            return const Center(child: Text('暂无可用 Agent'));
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: vm.agents.length,
            itemBuilder: (context, index) {
              final agent = vm.agents[index];
              return Card(
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: agent.enabled
                        ? Theme.of(context).colorScheme.primaryContainer
                        : Theme.of(context).colorScheme.surfaceContainerHighest,
                    child: Icon(
                      _iconForAgent(agent.id),
                      color: agent.enabled
                          ? Theme.of(context).colorScheme.onPrimaryContainer
                          : Theme.of(context).colorScheme.outline,
                    ),
                  ),
                  title: Text(agent.name),
                  subtitle: Text(
                    agent.description.isNotEmpty
                        ? agent.description
                        : agent.id,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Chip(
                        label: Text(
                          agent.enabled ? '已启用' : '已禁用',
                          style: TextStyle(
                            fontSize: 12,
                            color: agent.enabled
                                ? Theme.of(context).colorScheme.primary
                                : Theme.of(context).colorScheme.outline,
                          ),
                        ),
                        side: BorderSide.none,
                        backgroundColor: agent.enabled
                            ? Theme.of(context)
                                .colorScheme
                                .primaryContainer
                                .withValues(alpha: 0.5)
                            : null,
                      ),
                      const Icon(Icons.chevron_right),
                    ],
                  ),
                  onTap: () => context.go('/agents/${agent.id}'),
                ),
              );
            },
          );
        },
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
