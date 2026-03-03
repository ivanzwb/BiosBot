/// 对话记录模型
class Conversation {
  final String id;
  final String title;
  final String status;
  final String createdAt;
  final String updatedAt;

  Conversation({
    required this.id,
    required this.title,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'] as String,
      title: json['title'] as String,
      status: json['status'] as String,
      createdAt: json['created_at'] as String,
      updatedAt: json['updated_at'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'status': status,
        'created_at': createdAt,
        'updated_at': updatedAt,
      };
}
