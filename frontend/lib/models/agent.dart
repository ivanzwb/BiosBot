/// Agent 模型
class Agent {
  final String id;
  final String name;
  final bool enabled;
  final String description;
  final Map<String, dynamic>? defaultModel;

  Agent({
    required this.id,
    required this.name,
    required this.enabled,
    required this.description,
    this.defaultModel,
  });

  factory Agent.fromJson(Map<String, dynamic> json) {
    return Agent(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? json['id'] as String,
      enabled: (json['enabled'] as bool?) ?? true,
      description: (json['description'] as String?) ?? '',
      defaultModel: json['defaultModel'] as Map<String, dynamic>?,
    );
  }
}
