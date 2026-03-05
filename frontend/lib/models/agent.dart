/// Agent 模型
class Agent {
  final String id;
  final String name;
  final bool enabled;
  final String description;
  final List<String> labels;
  final String? model;
  final double? defaultTemperature;
  final String? systemPrompt;
  final String? source; // 'db' | 'file'

  Agent({
    required this.id,
    required this.name,
    required this.enabled,
    required this.description,
    this.labels = const [],
    this.model,
    this.defaultTemperature,
    this.systemPrompt,
    this.source,
  });

  factory Agent.fromJson(Map<String, dynamic> json) {
    final rawModel = json['model'];
    String? modelStr;
    if (rawModel is String) {
      modelStr = rawModel;
    } else if (rawModel is Map) {
      modelStr = rawModel['name']?.toString() ?? rawModel['model']?.toString();
    }
    return Agent(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? json['id'] as String,
      enabled: (json['enabled'] as bool?) ?? true,
      description: (json['description'] as String?) ?? '',
      labels: (json['labels'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      model: modelStr,
      defaultTemperature: (json['defaultTemperature'] as num?)?.toDouble(),
      systemPrompt: json['systemPrompt'] as String?,
      source: json['source'] as String?,
    );
  }
}

/// Skill 模型
class Skill {
  final String id;
  final String name;
  final String description;
  final String content;

  Skill({
    required this.id,
    required this.name,
    required this.description,
    required this.content,
  });

  factory Skill.fromJson(Map<String, dynamic> json) {
    return Skill(
      id: json['id'] as String,
      name: json['name'] as String,
      description: (json['description'] as String?) ?? '',
      content: (json['content'] as String?) ?? '',
    );
  }
}

/// Tool 参数定义
class ToolParam {
  String name;
  String type; // 'string' | 'number' | 'boolean'
  String description;
  bool required;

  ToolParam({
    required this.name,
    required this.type,
    required this.description,
    this.required = true,
  });

  factory ToolParam.fromJson(Map<String, dynamic> json) {
    return ToolParam(
      name: json['name'] as String,
      type: (json['type'] as String?) ?? 'string',
      description: (json['description'] as String?) ?? '',
      required: (json['required'] as bool?) ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'type': type,
    'description': description,
    'required': required,
  };
}

/// Agent Tool 配置
class AgentTool {
  final String id;
  final String name;
  final String description;
  final List<ToolParam> parameters;
  final Map<String, dynamic> handler;
  final bool enabled;

  AgentTool({
    required this.id,
    required this.name,
    required this.description,
    this.parameters = const [],
    required this.handler,
    this.enabled = true,
  });

  factory AgentTool.fromJson(Map<String, dynamic> json) {
    return AgentTool(
      id: json['id'] as String,
      name: json['name'] as String,
      description: (json['description'] as String?) ?? '',
      parameters: (json['parameters'] as List<dynamic>?)
          ?.map((e) => ToolParam.fromJson(e as Map<String, dynamic>))
          .toList() ?? [],
      handler: json['handler'] as Map<String, dynamic>? ?? {},
      enabled: (json['enabled'] as bool?) ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'description': description,
    'parameters': parameters.map((p) => p.toJson()).toList(),
    'handler': handler,
    'enabled': enabled,
  };

  String get handlerType => handler['type'] as String? ?? 'http';
}

/// 知识库文档摘要
class DocumentSummary {
  final String docId;
  final String title;
  final int chunkCount;

  DocumentSummary({
    required this.docId,
    required this.title,
    required this.chunkCount,
  });

  factory DocumentSummary.fromJson(Map<String, dynamic> json) {
    return DocumentSummary(
      docId: json['docId'] as String,
      title: (json['title'] as String?) ?? '',
      chunkCount: (json['chunkCount'] as int?) ?? 0,
    );
  }
}

/// 模型供应商
class ModelProvider {
  String id;
  String name;
  String model;
  String apiKey;
  String baseUrl;
  String? embeddingModel;

  ModelProvider({
    required this.id,
    required this.name,
    required this.model,
    required this.apiKey,
    required this.baseUrl,
    this.embeddingModel,
  });

  factory ModelProvider.fromJson(Map<String, dynamic> json) {
    return ModelProvider(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? '',
      model: (json['model'] as String?) ?? '',
      apiKey: (json['apiKey'] as String?) ?? '',
      baseUrl: (json['baseUrl'] as String?) ?? '',
      embeddingModel: json['embeddingModel'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'model': model,
    'apiKey': apiKey,
    'baseUrl': baseUrl,
    if (embeddingModel != null && embeddingModel!.isNotEmpty) 'embeddingModel': embeddingModel,
  };
}
