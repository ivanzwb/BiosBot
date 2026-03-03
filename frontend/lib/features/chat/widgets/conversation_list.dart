import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../viewmodels/chat_viewmodel.dart';

/// 左侧对话列表组件
class ConversationList extends StatelessWidget {
  const ConversationList({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<ChatViewModel>(
      builder: (context, vm, _) {
        return Column(
          children: [
            // 标题 + 新建对话按钮
            Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  Text(
                    'CloudBrain',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.add),
                    tooltip: '新建对话',
                    onPressed: () => vm.createConversation(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            // 对话列表
            Expanded(
              child: vm.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : vm.conversations.isEmpty
                      ? const Center(child: Text('暂无对话'))
                      : ListView.builder(
                          itemCount: vm.conversations.length,
                          itemBuilder: (context, index) {
                            final conv = vm.conversations[index];
                            final isSelected =
                                vm.currentConversation?.id == conv.id;
                            return ListTile(
                              selected: isSelected,
                              selectedTileColor: Theme.of(context)
                                  .colorScheme
                                  .primaryContainer
                                  .withValues(alpha: 0.3),
                              leading: const Icon(Icons.chat_bubble_outline,
                                  size: 20),
                              title: Text(
                                conv.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              trailing: PopupMenuButton<String>(
                                itemBuilder: (context) => [
                                  const PopupMenuItem(
                                    value: 'rename',
                                    child: Text('重命名'),
                                  ),
                                  const PopupMenuItem(
                                    value: 'delete',
                                    child: Text('删除'),
                                  ),
                                ],
                                onSelected: (action) {
                                  if (action == 'delete') {
                                    vm.deleteConversation(conv.id);
                                  } else if (action == 'rename') {
                                    _showRenameDialog(context, vm, conv.id,
                                        conv.title);
                                  }
                                },
                              ),
                              onTap: () => vm.selectConversation(conv),
                            );
                          },
                        ),
            ),
          ],
        );
      },
    );
  }

  void _showRenameDialog(BuildContext context, ChatViewModel vm,
      String convId, String currentTitle) {
    final controller = TextEditingController(text: currentTitle);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('重命名对话'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: '输入新标题'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              vm.renameConversation(convId, controller.text);
              Navigator.pop(context);
            },
            child: const Text('确定'),
          ),
        ],
      ),
    );
  }
}
