import '../models/conversation.dart';
import '../models/message.dart';
import '../models/task.dart';
import 'api_client.dart';

/// 对话/消息相关 API 服务
class ChatService {
  final ApiClient _api = ApiClient();

  /// 获取所有对话
  Future<List<Conversation>> getConversations() async {
    final data = await _api.get('/conversations');
    return (data as List).map((j) => Conversation.fromJson(j)).toList();
  }

  /// 创建新对话
  Future<Conversation> createConversation({String? title}) async {
    final data = await _api.post('/conversations', body: {'title': title});
    return Conversation.fromJson(data);
  }

  /// 获取某对话的消息列表
  Future<List<Message>> getMessages(String conversationId) async {
    final data = await _api.get('/conversations/$conversationId/messages');
    return (data as List).map((j) => Message.fromJson(j)).toList();
  }

  /// 发送消息（调用 Agent）
  Future<Map<String, dynamic>> sendMessage({
    required String conversationId,
    required String query,
    String? agentId,
  }) async {
    final data = await _api.post('/agent/invoke', body: {
      'conversationId': conversationId,
      'query': query,
      if (agentId != null) 'agentId': agentId,
    });
    return data as Map<String, dynamic>;
  }

  /// 更新对话
  Future<void> updateConversation(String id,
      {String? title, String? status}) async {
    await _api.put('/conversations/$id', body: {
      if (title != null) 'title': title,
      if (status != null) 'status': status,
    });
  }

  /// 删除对话
  Future<void> deleteConversation(String id) async {
    await _api.delete('/conversations/$id');
  }

  /// 获取任务状态
  Future<Task> getTask(String taskId) async {
    final data = await _api.get('/tasks/$taskId');
    return Task.fromJson(data);
  }

  /// 自动生成对话标题
  Future<String> generateTitle(String conversationId) async {
    final data = await _api.post('/conversations/$conversationId/generate-title');
    return (data as Map<String, dynamic>)['title'] as String? ?? '';
  }
}
