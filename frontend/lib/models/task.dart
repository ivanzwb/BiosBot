/// 任务模型
class Task {
  final String id;
  final String? conversationId;
  final String type;
  final String status;
  final String payload;
  final String? result;
  final int? progress;
  final String? error;
  final String createdAt;
  final String updatedAt;

  Task({
    required this.id,
    this.conversationId,
    required this.type,
    required this.status,
    required this.payload,
    this.result,
    this.progress,
    this.error,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Task.fromJson(Map<String, dynamic> json) {
    return Task(
      id: json['id'] as String,
      conversationId: json['conversation_id'] as String?,
      type: json['type'] as String,
      status: json['status'] as String,
      payload: json['payload'] as String,
      result: json['result'] as String?,
      progress: json['progress'] as int?,
      error: json['error'] as String?,
      createdAt: json['created_at'] as String,
      updatedAt: json['updated_at'] as String,
    );
  }

  bool get isPending => status == 'pending';
  bool get isRunning => status == 'running';
  bool get isCompleted => status == 'succeeded';
  bool get isFailed => status == 'failed';
}
