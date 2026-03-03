import '../models/agent.dart';
import 'api_client.dart';

/// Agent 管理与知识库 API 服务
class AgentService {
  final ApiClient _api = ApiClient();

  /// 获取所有 Agent 列表
  Future<List<Agent>> getAgents() async {
    final data = await _api.get('/agents');
    return (data as List).map((j) => Agent.fromJson(j)).toList();
  }

  /// 获取某 Agent 的知识库状态
  Future<Map<String, dynamic>> getKnowledgeStatus(String agentId) async {
    final data = await _api.get('/knowledge/$agentId');
    return data as Map<String, dynamic>;
  }

  /// 导入文档到 Agent 知识库
  Future<Map<String, dynamic>> ingestDocuments({
    required String agentId,
    required String conversationId,
    required List<Map<String, String>> documents,
  }) async {
    final data = await _api.post('/agent/ingest', body: {
      'agentId': agentId,
      'conversationId': conversationId,
      'documents': documents,
    });
    return data as Map<String, dynamic>;
  }

  /// 清空 Agent 知识库
  Future<void> clearKnowledge(String agentId) async {
    await _api.delete('/knowledge/$agentId');
  }

  /// 读取系统配置
  Future<List<dynamic>> getConfigs() async {
    final data = await _api.get('/admin/configs');
    return data as List<dynamic>;
  }

  /// 更新系统配置
  Future<void> updateConfig(String key, String value,
      {String scope = 'system'}) async {
    await _api.put('/admin/configs/$key', body: {
      'value': value,
      'scope': scope,
    });
  }
}
