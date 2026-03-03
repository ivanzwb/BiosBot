import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../models/conversation.dart';
import '../../../models/message.dart';
import '../../../services/chat_service.dart';
import '../../../core/config/app_config.dart';

/// 聊天页面状态管理
class ChatViewModel extends ChangeNotifier {
  final ChatService _chatService = ChatService();

  List<Conversation> _conversations = [];
  List<Conversation> get conversations => _conversations;

  Conversation? _currentConversation;
  Conversation? get currentConversation => _currentConversation;

  List<Message> _messages = [];
  List<Message> get messages => _messages;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _isSending = false;
  bool get isSending => _isSending;

  String? _error;
  String? get error => _error;

  Timer? _pollTimer;

  /// 加载对话列表
  Future<void> loadConversations() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _conversations = await _chatService.getConversations();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// 选择对话并加载消息
  Future<void> selectConversation(Conversation conversation) async {
    _currentConversation = conversation;
    notifyListeners();
    await loadMessages(conversation.id);
  }

  /// 加载消息
  Future<void> loadMessages(String conversationId) async {
    try {
      _messages = await _chatService.getMessages(conversationId);
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// 创建新对话
  Future<void> createConversation({String? title}) async {
    try {
      final conv = await _chatService.createConversation(title: title);
      _conversations.insert(0, conv);
      _currentConversation = conv;
      _messages = [];
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// 发送消息
  Future<void> sendMessage(String query) async {
    if (_currentConversation == null || query.trim().isEmpty) return;

    _isSending = true;
    _error = null;
    notifyListeners();

    // 乐观更新：先显示用户消息
    final tempUserMsg = Message(
      id: 'temp_${DateTime.now().millisecondsSinceEpoch}',
      conversationId: _currentConversation!.id,
      role: 'user',
      content: query,
      createdAt: DateTime.now().toIso8601String(),
    );
    _messages.add(tempUserMsg);
    notifyListeners();

    try {
      final result = await _chatService.sendMessage(
        conversationId: _currentConversation!.id,
        query: query,
      );

      final taskId = result['taskId'] as String?;
      if (taskId != null) {
        // 轮询任务结果
        _startPolling(taskId);
      }
    } catch (e) {
      _error = e.toString();
      _isSending = false;
      notifyListeners();
    }
  }

  /// 轮询任务状态
  void _startPolling(String taskId) {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(
      Duration(milliseconds: AppConfig.taskPollInterval),
      (timer) async {
        try {
          final task = await _chatService.getTask(taskId);
          if (task.isCompleted || task.isFailed) {
            timer.cancel();
            _isSending = false;
            // 重新加载消息获取最新
            if (_currentConversation != null) {
              await loadMessages(_currentConversation!.id);
            }
            notifyListeners();
          }
        } catch (e) {
          timer.cancel();
          _isSending = false;
          _error = e.toString();
          notifyListeners();
        }
      },
    );
  }

  /// 删除对话
  Future<void> deleteConversation(String id) async {
    try {
      await _chatService.deleteConversation(id);
      _conversations.removeWhere((c) => c.id == id);
      if (_currentConversation?.id == id) {
        _currentConversation = _conversations.isNotEmpty ? _conversations.first : null;
        if (_currentConversation != null) {
          await loadMessages(_currentConversation!.id);
        } else {
          _messages = [];
        }
      }
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// 重命名对话
  Future<void> renameConversation(String id, String newTitle) async {
    try {
      await _chatService.updateConversation(id, title: newTitle);
      final idx = _conversations.indexWhere((c) => c.id == id);
      if (idx >= 0) {
        _conversations[idx] = Conversation(
          id: _conversations[idx].id,
          title: newTitle,
          status: _conversations[idx].status,
          createdAt: _conversations[idx].createdAt,
          updatedAt: DateTime.now().toIso8601String(),
        );
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }
}
