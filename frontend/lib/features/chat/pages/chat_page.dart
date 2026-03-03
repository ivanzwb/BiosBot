import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../viewmodels/chat_viewmodel.dart';
import '../widgets/conversation_list.dart';
import '../widgets/message_bubble.dart';
import '../widgets/chat_input.dart';

/// 聊天主页面 — 左侧对话列表 + 中间消息区域 + 底部输入框
class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  @override
  void initState() {
    super.initState();
    // 进入页面时加载对话列表
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ChatViewModel>().loadConversations();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          // 左侧对话列表
          const SizedBox(
            width: 280,
            child: ConversationList(),
          ),
          const VerticalDivider(width: 1),
          // 右侧消息区域
          Expanded(
            child: Consumer<ChatViewModel>(
              builder: (context, vm, _) {
                if (vm.currentConversation == null) {
                  return const _EmptyState();
                }
                return Column(
                  children: [
                    // 顶部标题栏
                    _ConversationHeader(
                      title: vm.currentConversation!.title,
                    ),
                    const Divider(height: 1),
                    // 消息列表
                    Expanded(
                      child: vm.messages.isEmpty
                          ? const Center(
                              child: Text('发送消息开始对话'),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: vm.messages.length,
                              itemBuilder: (context, index) {
                                return MessageBubble(
                                  message: vm.messages[index],
                                );
                              },
                            ),
                    ),
                    // 加载指示器
                    if (vm.isSending)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            SizedBox(width: 8),
                            Text('Agent 正在思考...'),
                          ],
                        ),
                      ),
                    // 输入框
                    const ChatInput(),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.chat_bubble_outline,
              size: 64, color: Theme.of(context).colorScheme.outline),
          const SizedBox(height: 16),
          Text(
            '选择或创建一个对话开始',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.outline,
                ),
          ),
        ],
      ),
    );
  }
}

class _ConversationHeader extends StatelessWidget {
  final String title;
  const _ConversationHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: Theme.of(context).textTheme.titleMedium,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          // 导航按钮
          IconButton(
            icon: const Icon(Icons.smart_toy_outlined),
            tooltip: 'Agent 管理',
            onPressed: () => Navigator.of(context).pushNamed('/agents'),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: '设置',
            onPressed: () => Navigator.of(context).pushNamed('/settings'),
          ),
        ],
      ),
    );
  }
}
