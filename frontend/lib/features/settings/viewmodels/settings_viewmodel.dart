import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../../../services/agent_service.dart';

/// 设置页状态管理
class SettingsViewModel extends ChangeNotifier {
  final AgentService _agentService = AgentService();

  String _apiKey = '';
  String get apiKey => _apiKey;

  String _apiUrl = '';
  String get apiUrl => _apiUrl;

  String _defaultModel = '';
  String get defaultModel => _defaultModel;

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
          if (key == 'api_key') {
            _apiKey = value is String ? value : '';
          } else if (key == 'api_url') {
            _apiUrl = value is String ? value : '';
          } else if (key == 'agent_model_mapping') {
            _agentModelMapping =
                value is Map<String, dynamic> ? value : {};
            _defaultModel = _agentModelMapping['defaultModel']?.toString() ?? '';
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

  /// 保存设置（API Key、API URL、默认模型）
  Future<void> saveSettings({
    required String apiKey,
    required String apiUrl,
    required String defaultModel,
  }) async {
    try {
      await _agentService.updateConfig('api_key', jsonEncode(apiKey));
      await _agentService.updateConfig('api_url', jsonEncode(apiUrl));

      // 更新 agent_model_mapping 中的 defaultModel
      _agentModelMapping['defaultModel'] = defaultModel.isNotEmpty ? defaultModel : 'gpt-4.1-mini';
      await _agentService.updateConfig(
        'agent_model_mapping',
        jsonEncode(_agentModelMapping),
      );

      _apiKey = apiKey;
      _apiUrl = apiUrl;
      _defaultModel = defaultModel;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }
}
