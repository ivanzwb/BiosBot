import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../models/conversation.dart';
import '../../../models/message.dart';
import '../../../models/execution_step.dart';
import '../../../services/chat_service.dart';
import '../../../services/ws_service.dart';
import '../../../core/config/app_config.dart';
import '../../../core/lifecycle/app_lifecycle_manager.dart';

/// 聊天页面状态管理
class ChatViewModel extends ChangeNotifier with LifecycleAware {
  final ChatService _chatService = ChatService();
  final WsService _ws = WsService();

  ChatViewModel() {
    // 初始化时立即建立 WebSocket 连接
    _ws.connect();
  }

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

  /// 执行步骤列表（实时显示后端执行进度）
  List<ExecutionStep> _executionSteps = [];
  List<ExecutionStep> get executionSteps => _executionSteps;

  String? _error;
  String? get error => _error;

  Timer? _pollTimer;
  void Function()? _wsUnsub;
  void Function()? _stepUnsub;

  /// 加载对话列表
  Future<void> loadConversations() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _conversations = await _chatService.getConversations();
      _tryRestorePending();
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

  /// 发送消息 — 支持自动创建对话
  Future<void> sendMessage(String query) async {
    if (query.trim().isEmpty) return;

    _isSending = true;
    _error = null;
    notifyListeners();

    // 如果没有当前对话，先创建
    if (_currentConversation == null) {
      try {
        final conv = await _chatService.createConversation(
          title: query.length > 30 ? query.substring(0, 30) : query,
        );
        _conversations.insert(0, conv);
        _currentConversation = conv;
        notifyListeners();
      } catch (e) {
        _error = e.toString();
        _isSending = false;
        notifyListeners();
        return;
      }
    }

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

    // 清空之前的步骤，开始新任务
    _executionSteps = [];
    notifyListeners();

    // 提前注册步骤监听（通过 conversationId 过滤，因为 taskId 还没拿到）
    final currentConvId = _currentConversation!.id;
    String? currentTaskId;
    _stepUnsub?.call();
    _stepUnsub = _ws.onEventType('step:update', (payload) {
      if (payload is Map<String, dynamic>) {
        final stepData = payload['step'] as Map<String, dynamic>?;
        if (stepData != null) {
          // 如果已经拿到 taskId，精确匹配
          if (currentTaskId != null && payload['taskId'] == currentTaskId) {
            final step = ExecutionStep.fromJson(stepData);
            _updateOrAddStep(step);
            notifyListeners();
          } else if (currentTaskId == null && payload['conversationId'] == currentConvId) {
            // 还没拿到 taskId，但 conversationId 匹配
            final step = ExecutionStep.fromJson(stepData);
            _updateOrAddStep(step);
            notifyListeners();
          }
        }
      }
    });

    try {
      final result = await _chatService.sendMessage(
        conversationId: _currentConversation!.id,
        query: query,
      );

      final taskId = result['taskId'] as String?;
      if (taskId != null) {
        currentTaskId = taskId;
        // 同时使用 WebSocket 和轮询（race）
        _listenForTask(taskId);
        _startPolling(taskId);
      }
    } catch (e) {
      _addErrorMessage('请求失败：${e.toString()}');
      _isSending = false;
      notifyListeners();
    }
  }

  /// WebSocket 监听执行步骤（已移至 sendMessage 中提前注册）
  @Deprecated('步骤监听已移至 sendMessage 方法中提前注册')
  void _listenForSteps(String taskId) {
    // 保留空实现以兼容
  }

  /// 更新或添加步骤（根据 stepType 和 agentId 匹配）
  void _updateOrAddStep(ExecutionStep step) {
    // 对于 Agent 相关步骤，查找同一 Agent 的步骤进行更新
    if (step.stepType == StepType.agentStart || step.stepType == StepType.agentEnd) {
      final idx = _executionSteps.indexWhere(
        (s) => (s.stepType == StepType.agentStart || s.stepType == StepType.agentEnd) && s.agentId == step.agentId
      );
      if (idx >= 0) {
        _executionSteps[idx] = step;
        return;
      }
    } else {
      // 对于其他步骤，查找同类型步骤进行更新
      final idx = _executionSteps.indexWhere((s) => s.stepType == step.stepType);
      if (idx >= 0) {
        _executionSteps[idx] = step;
        return;
      }
    }
    // 未找到则添加
    _executionSteps.add(step);
  }

  /// WebSocket 监听任务完成
  void _listenForTask(String taskId) {
    _wsUnsub?.call();
    _wsUnsub = _ws.onEventType('task:update', (payload) {
      if (payload is Map<String, dynamic> &&
          payload['taskId'] == taskId) {
        final status = payload['status'] as String?;
        if (status == 'succeeded' || status == 'failed') {
          _wsUnsub?.call();
          _wsUnsub = null;
          _stepUnsub?.call();
          _stepUnsub = null;
          _pollTimer?.cancel();
          _pollTimer = null;
          _handleTaskComplete(status == 'succeeded', payload['error'] as String?);
        }
      }
    });
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
            _pollTimer = null;
            _wsUnsub?.call();
            _wsUnsub = null;
            _stepUnsub?.call();
            _stepUnsub = null;
            _handleTaskComplete(task.isCompleted, task.error);
          }
        } catch (e) {
          timer.cancel();
          _pollTimer = null;
          _wsUnsub?.call();
          _wsUnsub = null;
          _stepUnsub?.call();
          _stepUnsub = null;
          _isSending = false;
          _error = e.toString();
          notifyListeners();
        }
      },
    );
  }

  /// 任务完成处理
  Future<void> _handleTaskComplete(bool succeeded, String? error) async {
    _isSending = false;
    if (succeeded && _currentConversation != null) {
      await loadMessages(_currentConversation!.id);
      // 自动生成标题
      _autoGenerateTitle();
    } else if (!succeeded) {
      _addErrorMessage(error ?? '请求处理失败，请重试。');
    }
    notifyListeners();
  }

  /// 自动生成标题
  void _autoGenerateTitle() {
    if (_currentConversation == null) return;
    _chatService.generateTitle(_currentConversation!.id).then((title) {
      if (title.isNotEmpty && title != '新对话') {
        final idx = _conversations.indexWhere(
          (c) => c.id == _currentConversation!.id,
        );
        if (idx >= 0) {
          _conversations[idx] = Conversation(
            id: _conversations[idx].id,
            title: title,
            status: _conversations[idx].status,
            createdAt: _conversations[idx].createdAt,
            updatedAt: DateTime.now().toIso8601String(),
          );
          if (_currentConversation?.id == _conversations[idx].id) {
            _currentConversation = _conversations[idx];
          }
          notifyListeners();
        }
      }
    }).catchError((_) {});
  }

  void _addErrorMessage(String text) {
    if (_currentConversation == null) return;
    _messages.add(Message(
      id: 'err_${DateTime.now().millisecondsSinceEpoch}',
      conversationId: _currentConversation!.id,
      role: 'assistant',
      content: '⚠️ $text',
      createdAt: DateTime.now().toIso8601String(),
    ));
  }

  /// 清除当前选择（回到对话列表）
  void clearSelection() {
    _currentConversation = null;
    _messages = [];
    notifyListeners();
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
        if (_currentConversation?.id == id) {
          _currentConversation = _conversations[idx];
        }
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  // ====================== LifecycleAware ======================

  @override
  String get stateKey => 'chat';

  @override
  void onResumed() {
    // 回到前台：刷新对话列表 & 当前消息
    loadConversations();
    if (_currentConversation != null) {
      loadMessages(_currentConversation!.id);
    }
  }

  @override
  Map<String, dynamic>? saveState() {
    return {
      'currentConversationId': _currentConversation?.id,
    };
  }

  @override
  void restoreState(Map<String, dynamic> state) {
    final convId = state['currentConversationId'] as String?;
    if (convId != null && convId.isNotEmpty) {
      // 延迟恢复：等 loadConversations 完成后选中
      _pendingRestoreConvId = convId;
    }
  }

  String? _pendingRestoreConvId;

  /// 在 loadConversations 之后调用，如果有待恢复的 conversationId 则自动选中
  void _tryRestorePending() {
    if (_pendingRestoreConvId != null) {
      final match = _conversations
          .where((c) => c.id == _pendingRestoreConvId)
          .toList();
      if (match.isNotEmpty) {
        selectConversation(match.first);
      }
      _pendingRestoreConvId = null;
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _wsUnsub?.call();
    _stepUnsub?.call();
    super.dispose();
  }
}
