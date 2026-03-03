import 'package:flutter/foundation.dart';
import '../../../models/agent.dart';
import '../../../services/agent_service.dart';

/// Agent 管理状态
class AgentsViewModel extends ChangeNotifier {
  final AgentService _agentService = AgentService();

  List<Agent> _agents = [];
  List<Agent> get agents => _agents;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  Map<String, Map<String, dynamic>> _knowledgeStatus = {};
  Map<String, dynamic>? getKnowledgeStatus(String agentId) =>
      _knowledgeStatus[agentId];

  /// 加载 Agent 列表
  Future<void> loadAgents() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _agents = await _agentService.getAgents();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// 加载某 Agent 的知识库状态
  Future<void> loadKnowledgeStatus(String agentId) async {
    try {
      final status = await _agentService.getKnowledgeStatus(agentId);
      _knowledgeStatus[agentId] = status;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// 清空某 Agent 的知识库
  Future<void> clearKnowledge(String agentId) async {
    try {
      await _agentService.clearKnowledge(agentId);
      _knowledgeStatus.remove(agentId);
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }
}
