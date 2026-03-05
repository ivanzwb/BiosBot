import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../viewmodels/chat_viewmodel.dart';
import '../../../utils/format_utils.dart';

/// 对话列表组件
class ConversationList extends StatelessWidget {
  final VoidCallback? onSelected;
  const ConversationList({super.key, this.onSelected});

  @override
  Widget build(BuildContext context) {
    return Consumer<ChatViewModel>(
      builder: (context, vm, _) {
        return ListView.builder(
          itemCount: vm.conversations.length,
          itemBuilder: (context, index) {
            final conv = vm.conversations[index];
            final isSelected = vm.currentConversation?.id == conv.id;
            return ListTile(
              selected: isSelected,
              selectedTileColor: Theme.of(context)
                  .colorScheme
                  .primaryContainer
                  .withValues(alpha: 0.3),
              leading: const Icon(Icons.chat_bubble_outline, size: 20),
              title: Text(
                conv.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                formatDateTime(conv.updatedAt),
                style: Theme.of(context).textTheme.bodySmall,
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
                    _showRenameDialog(context, vm, conv.id, conv.title);
                  }
                },
              ),
              onTap: () {
                vm.selectConversation(conv);
                onSelected?.call();
              },
            );
          },
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
