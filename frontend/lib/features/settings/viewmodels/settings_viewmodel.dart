import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../../../models/agent.dart';
import '../../../services/agent_service.dart';

/// 设置页状态管理
class SettingsViewModel extends ChangeNotifier {
  final AgentService _svc = AgentService();

  // 模型供应商列表
  List<ModelProvider> _models = [];
  List<ModelProvider> get models => _models;

  String _defaultModelId = '';
  String get defaultModelId => _defaultModelId;

  // Proxy Agent 配置
  String _proxyModel = '';
  String get proxyModel => _proxyModel;
  double _proxyTemperature = 0.7;
  double get proxyTemperature => _proxyTemperature;
  String _proxyClassifyPrompt = '';
  String get proxyClassifyPrompt => _proxyClassifyPrompt;
  String _proxyAggregatePrompt = '';
  String get proxyAggregatePrompt => _proxyAggregatePrompt;

  // Proxy Skills / Tools / KB
  List<Skill> proxySkills = [];
  List<AgentTool> proxyTools = [];
  List<DocumentSummary> proxyDocs = [];
  bool loadingSkills = false;
  bool loadingTools = false;
  bool loadingDocs = false;

  Map<String, dynamic> _agentModelMapping = {};

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  String? _toast;
  String? get toast => _toast;

  // 模型测试结果
  Map<String, Map<String, dynamic>> _testResults = {};
  Map<String, dynamic>? getTestResult(String modelId) => _testResults[modelId];

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

  /// 加载所有设置数据
  Future<void> loadConfigs() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Load models list
      try {
        final modelsCfg = await _svc.getConfig('models');
        final list = jsonDecode(modelsCfg['value'] as String);
        if (list is List) {
          _models = list.map((j) => ModelProvider.fromJson(j)).toList();
        }
      } catch (_) {}

      // Load agent_model_mapping
      try {
        final mappingCfg = await _svc.getConfig('agent_model_mapping');
        _agentModelMapping =
            jsonDecode(mappingCfg['value'] as String) as Map<String, dynamic>;
        _defaultModelId = _agentModelMapping['defaultModel']?.toString() ?? '';
        final proxyCfg = (_agentModelMapping['agents']
            as Map<String, dynamic>?)?['proxy-agent'];
        if (proxyCfg is Map<String, dynamic>) {
          _proxyModel = proxyCfg['model']?.toString() ?? '';
          _proxyTemperature =
              (proxyCfg['temperature'] as num?)?.toDouble() ?? 0.7;
          _proxyClassifyPrompt =
              proxyCfg['classifyPrompt']?.toString() ?? '';
          _proxyAggregatePrompt =
              proxyCfg['aggregatePrompt']?.toString() ?? '';
        }
      } catch (_) {}

      // Load test results
      try {
        final cfg = await _svc.getConfig('model_test_results');
        final parsed = jsonDecode(cfg['value'] as String);
        if (parsed is Map<String, dynamic>) {
          _testResults = parsed.map(
              (k, v) => MapEntry(k, v as Map<String, dynamic>));
        }
      } catch (_) {}
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// 加载 Proxy Agent 的 Skills, Tools, KB
  Future<void> loadProxyExtras() async {
    loadingSkills = true;
    loadingTools = true;
    loadingDocs = true;
    notifyListeners();

    try {
      proxySkills = await _svc.listSkills('proxy-agent');
    } catch (_) {
      proxySkills = [];
    }
    loadingSkills = false;
    notifyListeners();

    try {
      proxyTools = await _svc.listTools('proxy-agent');
    } catch (_) {
      proxyTools = [];
    }
    loadingTools = false;
    notifyListeners();

    try {
      proxyDocs = await _svc.listKnowledgeDocs('proxy-agent');
    } catch (_) {
      proxyDocs = [];
    }
    loadingDocs = false;
    notifyListeners();
  }

  // ============ 模型 CRUD ============

  Future<void> _persistModels() async {
    await _svc.updateConfig(
        'models', jsonEncode(_models.map((m) => m.toJson()).toList()));
    notifyListeners();
  }

  Future<void> addModel(ModelProvider m) async {
    _models.add(m);
    await _persistModels();
    if (_defaultModelId.isEmpty) {
      await setDefaultModel(m.id);
    }
    flash('已保存');
  }

  Future<void> updateModel(ModelProvider m) async {
    final idx = _models.indexWhere((x) => x.id == m.id);
    if (idx >= 0) _models[idx] = m;
    await _persistModels();
    flash('已保存');
  }

  Future<void> deleteModel(String id) async {
    _models.removeWhere((m) => m.id == id);
    await _persistModels();
    if (_defaultModelId == id) {
      await setDefaultModel(_models.isNotEmpty ? _models.first.id : '');
    }
    flash('已删除');
  }

  Future<void> setDefaultModel(String id) async {
    _agentModelMapping['defaultModel'] = id;
    await _svc.updateConfig(
        'agent_model_mapping', jsonEncode(_agentModelMapping));
    _defaultModelId = id;
    notifyListeners();
    flash('已设为默认');
  }

  /// 测试模型
  Future<void> testModel(ModelProvider m) async {
    try {
      final result = await _svc.testModel(
        modelId: m.id,
        model: m.model,
        apiKey: m.apiKey,
        baseUrl: m.baseUrl,
      );
      _testResults[m.id] = result;
      notifyListeners();
    } catch (e) {
      _testResults[m.id] = {'success': false, 'message': e.toString()};
      notifyListeners();
    }
  }

  // ============ Proxy Agent 配置 ============

  Future<void> saveProxyConfig({
    String? model,
    double? temperature,
    String? classifyPrompt,
    String? aggregatePrompt,
  }) async {
    try {
      _agentModelMapping['agents'] ??= {};
      final agents = _agentModelMapping['agents'] as Map<String, dynamic>;
      agents['proxy-agent'] ??= {};
      final proxy = agents['proxy-agent'] as Map<String, dynamic>;

      if (model != null) {
        if (model.isEmpty) {
          proxy.remove('model');
        } else {
          proxy['model'] = model;
        }
        _proxyModel = model;
      }
      if (temperature != null) {
        proxy['temperature'] = temperature;
        _proxyTemperature = temperature;
      }
      if (classifyPrompt != null) {
        if (classifyPrompt.trim().isEmpty) {
          proxy.remove('classifyPrompt');
        } else {
          proxy['classifyPrompt'] = classifyPrompt.trim();
        }
        _proxyClassifyPrompt = classifyPrompt;
      }
      if (aggregatePrompt != null) {
        if (aggregatePrompt.trim().isEmpty) {
          proxy.remove('aggregatePrompt');
        } else {
          proxy['aggregatePrompt'] = aggregatePrompt.trim();
        }
        _proxyAggregatePrompt = aggregatePrompt;
      }

      await _svc.updateConfig(
          'agent_model_mapping', jsonEncode(_agentModelMapping));
      flash('已保存');
      notifyListeners();
    } catch (e) {
      flash('保存失败: $e');
    }
  }
}
