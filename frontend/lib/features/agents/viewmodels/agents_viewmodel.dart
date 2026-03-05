import 'package:flutter/foundation.dart';
import '../../../models/agent.dart';
import '../../../services/agent_service.dart';
import '../../../core/lifecycle/app_lifecycle_manager.dart';

/// Agent 管理状态
class AgentsViewModel extends ChangeNotifier with LifecycleAware {
  final AgentService _agentService = AgentService();

  List<Agent> _agents = [];
  List<Agent> get agents => _agents;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _isRefreshing = false;
  bool get isRefreshing => _isRefreshing;

  String? _error;
  String? get error => _error;

  String? _toast;
  String? get toast => _toast;

  Map<String, Map<String, dynamic>> _knowledgeStatus = {};
  Map<String, dynamic>? getKnowledgeStatus(String agentId) =>
      _knowledgeStatus[agentId];

  void clearToast() {
    _toast = null;
    notifyListeners();
  }

  void flash(String msg) {
    _toast = msg;
    notifyListeners();
    Future.delayed(const Duration(seconds: 3), () {
      if (_toast == msg) {
        _toast = null;
        notifyListeners();
      }
    });
  }

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

  /// 刷新 Agent 列表
  Future<void> refreshAgents() async {
    _isRefreshing = true;
    notifyListeners();
    try {
      await _agentService.refreshAgents();
      await loadAgents();
      flash('已刷新');
    } catch (e) {
      flash('刷新失败: $e');
    } finally {
      _isRefreshing = false;
      notifyListeners();
    }
  }

  /// 创建 Agent
  Future<bool> createAgent({
    required String id,
    required String name,
    String? description,
    List<String>? labels,
    double? defaultTemperature,
    String? systemPrompt,
  }) async {
    try {
      await _agentService.createAgent(
        id: id,
        name: name,
        description: description,
        labels: labels,
        defaultTemperature: defaultTemperature,
        systemPrompt: systemPrompt,
      );
      flash('Agent 已创建');
      await loadAgents();
      return true;
    } catch (e) {
      flash('创建失败: $e');
      return false;
    }
  }

  /// 删除 Agent
  Future<void> deleteAgent(String agentId) async {
    try {
      await _agentService.deleteAgent(agentId);
      _agents.removeWhere((a) => a.id == agentId);
      flash('已删除');
      notifyListeners();
    } catch (e) {
      flash('删除失败: $e');
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
      flash('知识库已清空');
      notifyListeners();
    } catch (e) {
      flash('清空失败: $e');
    }
  }

  // ====================== LifecycleAware ======================

  @override
  String get stateKey => 'agents';

  @override
  void onResumed() {
    // 回到前台时刷新 Agent 列表
    loadAgents();
  }

  @override
  Map<String, dynamic>? saveState() {
    // Agent 列表是服务端数据，不需要本地持久化
    return null;
  }

  @override
  void restoreState(Map<String, dynamic> state) {
    // no-op
  }
}
