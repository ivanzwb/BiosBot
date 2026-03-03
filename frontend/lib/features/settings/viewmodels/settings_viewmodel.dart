import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../../../services/agent_service.dart';

/// 设置页状态管理
class SettingsViewModel extends ChangeNotifier {
  final AgentService _agentService = AgentService();

  Map<String, dynamic> _apiKeys = {};
  Map<String, dynamic> get apiKeys => _apiKeys;

  Map<String, dynamic> _agentModelMapping = {};
  Map<String, dynamic> get agentModelMapping => _agentModelMapping;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  /// 加载系统配置
  Future<void> loadConfigs() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final configs = await _agentService.getConfigs();
      for (var cfg in configs) {
        final key = cfg['key'] as String;
        try {
          final value = jsonDecode(cfg['value'] as String);
          if (key == 'api_keys') {
            _apiKeys = value is Map<String, dynamic> ? value : {};
          } else if (key == 'agent_model_mapping') {
            _agentModelMapping =
                value is Map<String, dynamic> ? value : {};
          }
        } catch (_) {}
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// 保存 API Keys
  Future<void> saveApiKeys(Map<String, String> keys) async {
    try {
      await _agentService.updateConfig(
        'api_keys',
        jsonEncode(keys),
      );
      _apiKeys = keys;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// 保存 Agent 模型映射
  Future<void> saveAgentModelMapping(Map<String, dynamic> mapping) async {
    try {
      await _agentService.updateConfig(
        'agent_model_mapping',
        jsonEncode(mapping),
      );
      _agentModelMapping = mapping;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }
}
