import '../models/agent.dart';
import 'api_client.dart';

/// Agent 管理、知识库、Skills、Tools API 服务
class AgentService {
  final ApiClient _api = ApiClient();

  // ============================================================
  // Agent CRUD
  // ============================================================

  /// 获取所有 Agent 列表
  Future<List<Agent>> getAgents() async {
    final data = await _api.get('/agents');
    return (data as List).map((j) => Agent.fromJson(j)).toList();
  }

  /// 创建 Agent
  Future<Agent> createAgent({
    required String id,
    required String name,
    String? description,
    List<String>? labels,
    double? defaultTemperature,
    String? systemPrompt,
  }) async {
    final data = await _api.post('/agents', body: {
      'id': id,
      'name': name,
      if (description != null) 'description': description,
      if (labels != null) 'labels': labels,
      if (defaultTemperature != null) 'defaultTemperature': defaultTemperature,
      if (systemPrompt != null) 'systemPrompt': systemPrompt,
    });
    return Agent.fromJson((data as Map<String, dynamic>)['agent']);
  }

  /// 删除 Agent
  Future<void> deleteAgent(String agentId) async {
    await _api.delete('/agents/$agentId');
  }

  /// 更新 Agent 配置
  Future<void> updateAgentConfig(String agentId, {
    String? name,
    String? description,
    List<String>? labels,
    double? defaultTemperature,
    String? systemPrompt,
  }) async {
    await _api.put('/agents/$agentId/config', body: {
      if (name != null) 'name': name,
      if (description != null) 'description': description,
      if (labels != null) 'labels': labels,
      if (defaultTemperature != null) 'defaultTemperature': defaultTemperature,
      if (systemPrompt != null) 'systemPrompt': systemPrompt,
    });
  }

  /// 刷新 Agent 列表（重新扫描文件系统）
  Future<int> refreshAgents() async {
    final data = await _api.post('/agents/refresh');
    return (data as Map<String, dynamic>)['registered'] as int? ?? 0;
  }

  // ============================================================
  // 知识库管理
  // ============================================================

  /// 获取某 Agent 的知识库状态
  Future<Map<String, dynamic>> getKnowledgeStatus(String agentId) async {
    final data = await _api.get('/knowledge/$agentId');
    return data as Map<String, dynamic>;
  }

  /// 获取所有 Agent 的知识库概况
  Future<List<Map<String, dynamic>>> getAllKnowledgeStatus() async {
    final data = await _api.get('/knowledge/all-status');
    return (data as List).map((e) => e as Map<String, dynamic>).toList();
  }

  /// 获取知识库文档列表
  Future<List<DocumentSummary>> listKnowledgeDocs(String agentId) async {
    final data = await _api.get('/knowledge/$agentId/documents');
    return (data as List).map((j) => DocumentSummary.fromJson(j)).toList();
  }

  /// 删除知识库文档
  Future<void> deleteKnowledgeDoc(String agentId, String docId) async {
    await _api.delete('/knowledge/$agentId/documents/${Uri.encodeComponent(docId)}');
  }

  /// 导入文档到 Agent 知识库
  Future<Map<String, dynamic>> ingestDocuments({
    required String agentId,
    required List<Map<String, String>> documents,
    String? conversationId,
  }) async {
    final data = await _api.post('/agent/ingest', body: {
      'agentId': agentId,
      'conversationId': conversationId ?? '',
      'documents': documents,
    });
    return data as Map<String, dynamic>;
  }

  /// 清空 Agent 知识库
  Future<void> clearKnowledge(String agentId) async {
    await _api.delete('/knowledge/$agentId');
  }

  // ============================================================
  // Skills 管理
  // ============================================================

  /// 获取 Agent 的 Skills 列表
  Future<List<Skill>> listSkills(String agentId) async {
    final data = await _api.get('/agents/$agentId/skills');
    return (data as List).map((j) => Skill.fromJson(j)).toList();
  }

  /// 创建 Skill
  Future<Skill> createSkill(String agentId, {
    required String id,
    required String name,
    String? description,
    required String content,
  }) async {
    final data = await _api.post('/agents/$agentId/skills', body: {
      'id': id,
      'name': name,
      'description': description ?? '',
      'content': content,
    });
    return Skill.fromJson((data as Map<String, dynamic>)['skill']);
  }

  /// 更新 Skill
  Future<void> updateSkill(String agentId, String skillId, {
    String? name,
    String? description,
    String? content,
  }) async {
    await _api.put('/agents/$agentId/skills/${Uri.encodeComponent(skillId)}', body: {
      if (name != null) 'name': name,
      if (description != null) 'description': description,
      if (content != null) 'content': content,
    });
  }

  /// 删除 Skill
  Future<void> deleteSkill(String agentId, String skillId) async {
    await _api.delete('/agents/$agentId/skills/${Uri.encodeComponent(skillId)}');
  }

  // ============================================================
  // Tools 管理
  // ============================================================

  /// 获取 Agent 的 Tools 列表
  Future<List<AgentTool>> listTools(String agentId) async {
    final data = await _api.get('/agents/$agentId/tools');
    return (data as List).map((j) => AgentTool.fromJson(j)).toList();
  }

  /// 创建 Tool
  Future<AgentTool> createTool(String agentId, Map<String, dynamic> tool) async {
    final data = await _api.post('/agents/$agentId/tools', body: tool);
    return AgentTool.fromJson((data as Map<String, dynamic>)['tool']);
  }

  /// 更新 Tool
  Future<void> updateTool(String agentId, String toolId, Map<String, dynamic> fields) async {
    await _api.put('/agents/$agentId/tools/${Uri.encodeComponent(toolId)}', body: fields);
  }

  /// 删除 Tool
  Future<void> deleteTool(String agentId, String toolId) async {
    await _api.delete('/agents/$agentId/tools/${Uri.encodeComponent(toolId)}');
  }

  // ============================================================
  // 配置管理
  // ============================================================

  /// 读取系统配置列表
  Future<List<dynamic>> getConfigs() async {
    final data = await _api.get('/admin/configs');
    return data as List<dynamic>;
  }

  /// 读取单个配置
  Future<Map<String, dynamic>> getConfig(String key) async {
    final data = await _api.get('/admin/configs/$key');
    return data as Map<String, dynamic>;
  }

  /// 更新系统配置
  Future<void> updateConfig(String key, String value) async {
    await _api.put('/admin/configs/$key', body: {'value': value});
  }

  // ============================================================
  // 模型测试
  // ============================================================

  /// 测试模型连通性
  Future<Map<String, dynamic>> testModel({
    String? modelId,
    required String model,
    required String apiKey,
    String? baseUrl,
  }) async {
    final data = await _api.post('/admin/test-model', body: {
      if (modelId != null) 'modelId': modelId,
      'model': model,
      'apiKey': apiKey,
      if (baseUrl != null) 'baseUrl': baseUrl,
    });
    return data as Map<String, dynamic>;
  }
}
