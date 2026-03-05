/// 消息模型
class Message {
  final String id;
  final String conversationId;
  final String role; // 'user' | 'assistant' | 'system' | 'agent'
  final String content;
  final String? agentId;
  final String createdAt;

  Message({
    required this.id,
    required this.conversationId,
    required this.role,
    required this.content,
    this.agentId,
    required this.createdAt,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as String,
      conversationId: json['conversation_id'] as String,
      role: json['role'] as String,
      content: json['content'] as String,
      agentId: json['agent_id'] as String?,
      createdAt: json['created_at'] as String,
    );
  }

  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant' || role == 'agent';
}
