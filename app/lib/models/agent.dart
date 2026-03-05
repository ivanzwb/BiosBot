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

/// MCP Server 配置
class McpServerConfig {
  final String id;
  final String type; // 'local' or 'remote'
  final bool enabled;

  // 本地 MCP Server 配置 (type = 'local')
  final String? command;
  final List<String> args;
  final Map<String, String> env;

  // 远程 MCP Server 配置 (type = 'remote')
  final String? url;
  final Map<String, String> headers;

  McpServerConfig({
    required this.id,
    this.type = 'local',
    this.enabled = true,
    this.command,
    this.args = const [],
    this.env = const {},
    this.url,
    this.headers = const {},
  });

  bool get isLocal => type == 'local';
  bool get isRemote => type == 'remote';

  factory McpServerConfig.fromJson(Map<String, dynamic> json) {
    return McpServerConfig(
      id: json['id'] as String,
      type: (json['type'] as String?) ?? 'local',
      enabled: (json['enabled'] as bool?) ?? true,
      command: json['command'] as String?,
      args: (json['args'] as List<dynamic>?)?.cast<String>() ?? [],
      env: (json['env'] as Map<String, dynamic>?)?.cast<String, String>() ?? {},
      url: json['url'] as String?,
      headers: (json['headers'] as Map<String, dynamic>?)?.cast<String, String>() ?? {},
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type,
    'enabled': enabled,
    if (type == 'local') ...{
      'command': command,
      'args': args,
      'env': env,
    },
    if (type == 'remote') ...{
      'url': url,
      'headers': headers,
    },
  };

  McpServerConfig copyWith({
    String? id,
    String? type,
    bool? enabled,
    String? command,
    List<String>? args,
    Map<String, String>? env,
    String? url,
    Map<String, String>? headers,
  }) {
    return McpServerConfig(
      id: id ?? this.id,
      type: type ?? this.type,
      enabled: enabled ?? this.enabled,
      command: command ?? this.command,
      args: args ?? this.args,
      env: env ?? this.env,
      url: url ?? this.url,
      headers: headers ?? this.headers,
    );
  }
}

/// MCP Tool 简单信息（用于测试结果）
class McpToolSimple {
  final String name;
  final String? description;

  McpToolSimple({required this.name, this.description});

  factory McpToolSimple.fromJson(Map<String, dynamic> json) {
    return McpToolSimple(
      name: json['name'] as String,
      description: json['description'] as String?,
    );
  }
}

/// MCP Tool 信息
class McpTool {
  final String name;
  final String? description;
  final Map<String, dynamic>? inputSchema;

  McpTool({
    required this.name,
    this.description,
    this.inputSchema,
  });

  factory McpTool.fromJson(Map<String, dynamic> json) {
    return McpTool(
      name: json['name'] as String,
      description: json['description'] as String?,
      inputSchema: json['inputSchema'] as Map<String, dynamic>?,
    );
  }
}

/// MCP 包安装结果
class McpPackageInstallResult {
  final bool success;
  final String packageName;
  final String? message;
  final String? stdout;
  final String? code;
  final String? stderr;
  final String? npmLog; // 详细的 npm 日志文件内容

  McpPackageInstallResult({
    required this.success,
    required this.packageName,
    this.message,
    this.stdout,
    this.code,
    this.stderr,
    this.npmLog,
  });

  factory McpPackageInstallResult.fromJson(Map<String, dynamic> json) {
    return McpPackageInstallResult(
      success: json['success'] as bool,
      packageName: json['packageName'] as String,
      message: json['message'] as String?,
      stdout: json['stdout'] as String?,
      code: json['code'] as String?,
      stderr: json['stderr'] as String?,
      npmLog: json['npmLog'] as String?,
    );
  }
}

/// 已安装的 MCP 包
class InstalledMcpPackage {
  final String name;
  final String version;

  InstalledMcpPackage({required this.name, required this.version});

  factory InstalledMcpPackage.fromJson(Map<String, dynamic> json) {
    return InstalledMcpPackage(
      name: json['name'] as String,
      version: json['version'] as String,
    );
  }
}

/// MCP Tool 信息
class McpToolInfo {
  final String name;
  final String? description;

  McpToolInfo({required this.name, this.description});

  factory McpToolInfo.fromJson(Map<String, dynamic> json) {
    return McpToolInfo(
      name: json['name'] as String,
      description: json['description'] as String?,
    );
  }
}

/// MCP Tools 探测结果
class McpProbeToolsResult {
  final bool success;
  final String packageName;
  final List<McpToolInfo> tools;
  final String? error;

  McpProbeToolsResult({
    required this.success,
    required this.packageName,
    required this.tools,
    this.error,
  });

  factory McpProbeToolsResult.fromJson(Map<String, dynamic> json) {
    return McpProbeToolsResult(
      success: json['success'] as bool,
      packageName: json['packageName'] as String,
      tools: (json['tools'] as List<dynamic>?)
              ?.map((e) => McpToolInfo.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      error: json['error'] as String?,
    );
  }
}

/// MCP Server 测试结果
class McpTestResult {
  final bool success;
  final String serverId;
  final String testTime;
  final List<McpToolSimple> tools;
  final String? error;

  McpTestResult({
    required this.success,
    required this.serverId,
    required this.testTime,
    required this.tools,
    this.error,
  });

  factory McpTestResult.fromJson(Map<String, dynamic> json) {
    return McpTestResult(
      success: json['success'] as bool,
      serverId: json['serverId'] as String,
      testTime: json['testTime'] as String,
      tools: (json['tools'] as List<dynamic>?)
              ?.map((e) => McpToolSimple.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      error: json['error'] as String?,
    );
  }
}
