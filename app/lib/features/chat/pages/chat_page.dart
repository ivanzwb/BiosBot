import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../viewmodels/chat_viewmodel.dart';
import '../widgets/conversation_list.dart';
import '../widgets/message_bubble.dart';
import '../widgets/chat_input.dart';
import '../widgets/execution_steps_indicator.dart';

/// 聊天主页面 — 移动端: 对话列表 ↔ 消息视图切换; 宽屏: 左右分栏
class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ChatViewModel>().loadConversations();
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.of(context).size.width > 600;

    return Consumer<ChatViewModel>(
      builder: (context, vm, _) {
        // 宽屏: 左右分栏
        if (isWide) {
          return Row(
            children: [
              SizedBox(
                width: 300,
                child: _ConversationPanel(onSelected: () => _scrollToBottom()),
              ),
              const VerticalDivider(width: 1),
              Expanded(
                child: _ChatPanel(
                  scrollController: _scrollController,
                  onSent: _scrollToBottom,
                ),
              ),
            ],
          );
        }

        // 窄屏: 选中对话则显示消息视图，否则显示对话列表
        if (vm.currentConversation != null) {
          return _ChatPanel(
            scrollController: _scrollController,
            onSent: _scrollToBottom,
            showBack: true,
          );
        }
        return _ConversationPanel(onSelected: () => _scrollToBottom());
      },
    );
  }
}

/// 对话列表面板
class _ConversationPanel extends StatelessWidget {
  final VoidCallback onSelected;
  const _ConversationPanel({required this.onSelected});

  @override
  Widget build(BuildContext context) {
    final vm = context.watch<ChatViewModel>();
    return Column(
      children: [
        // 标题 + 新建对话按钮
        AppBar(
          automaticallyImplyLeading: false,
          title: const Text('BiosBot'),
          actions: [
            IconButton(
              icon: const Icon(Icons.add),
              tooltip: '新建对话',
              onPressed: () {
                vm.createConversation();
                onSelected();
              },
            ),
          ],
        ),
        Expanded(
          child: vm.isLoading
              ? const Center(child: CircularProgressIndicator())
              : vm.conversations.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.chat_bubble_outline,
                              size: 48,
                              color: Theme.of(context).colorScheme.outline),
                          const SizedBox(height: 12),
                          Text('暂无对话',
                              style: TextStyle(
                                  color:
                                      Theme.of(context).colorScheme.outline)),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            icon: const Icon(Icons.add),
                            label: const Text('新建对话'),
                            onPressed: () {
                              vm.createConversation();
                              onSelected();
                            },
                          ),
                        ],
                      ),
                    )
                  : ConversationList(onSelected: onSelected),
        ),
      ],
    );
  }
}

/// 消息视图面板
class _ChatPanel extends StatelessWidget {
  final ScrollController scrollController;
  final VoidCallback onSent;
  final bool showBack;

  const _ChatPanel({
    required this.scrollController,
    required this.onSent,
    this.showBack = false,
  });

  @override
  Widget build(BuildContext context) {
    final vm = context.watch<ChatViewModel>();

    if (vm.currentConversation == null) {
      return _EmptyState(onSent: onSent);
    }

    return Column(
      children: [
        // 顶部标题栏
        AppBar(
          automaticallyImplyLeading: false,
          leading: showBack
              ? IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () {
                    // 取消选择，回到对话列表
                    vm.selectConversation(vm.currentConversation!).then((_) {
                      // hack: set current to null
                    });
                    // 直接清空 currentConversation
                    vm.clearSelection();
                  },
                )
              : null,
          title: Text(
            vm.currentConversation!.title,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        // 消息列表
        Expanded(
          child: vm.messages.isEmpty
              ? const Center(child: Text('发送消息开始对话'))
              : ListView.builder(
                  controller: scrollController,
                  padding: const EdgeInsets.all(16),
                  itemCount: vm.messages.length,
                  itemBuilder: (context, index) {
                    return MessageBubble(message: vm.messages[index]);
                  },
                ),
        ),
        // 执行步骤指示器（实时显示后端执行进度）
        if (vm.isSending && vm.executionSteps.isNotEmpty)
          ExecutionStepsIndicator(steps: vm.executionSteps)
        else if (vm.isSending)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
                const SizedBox(width: 8),
                const Text('Agent 正在思考...'),
              ],
            ),
          ),
        // 输入框
        ChatInput(onSent: onSent),
      ],
    );
  }
}

/// 空状态 — 没有选中对话时
class _EmptyState extends StatelessWidget {
  final VoidCallback onSent;
  const _EmptyState({required this.onSent});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.terminal,
                    size: 72,
                    color: Theme.of(context).colorScheme.primary),
                const SizedBox(height: 16),
                Text(
                  'BiosBot',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  '你的多智能体助手。输入问题开始对话。',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.outline,
                  ),
                ),
              ],
            ),
          ),
        ),
        ChatInput(onSent: onSent),
      ],
    );
  }
}
