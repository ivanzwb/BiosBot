import 'dart:convert';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/ws_service.dart';

/// 集中管理 App 生命周期：
/// - 前后台切换时控制 WebSocket 连接
/// - paused / detached 时持久化关键状态
/// - resumed 时恢复状态 & 刷新数据
class AppLifecycleManager with WidgetsBindingObserver {
  static final AppLifecycleManager _instance = AppLifecycleManager._();
  factory AppLifecycleManager() => _instance;
  AppLifecycleManager._();

  final WsService _ws = WsService();

  /// 注册的状态恢复回调
  final List<LifecycleAware> _listeners = [];

  /// 当前生命周期状态
  AppLifecycleState? _lastState;
  AppLifecycleState? get lastState => _lastState;

  // ====================== 初始化 ======================

  /// App 启动时调用一次
  Future<void> init() async {
    WidgetsBinding.instance.addObserver(this);
    _ws.connect();
    // 恢复上次保存的状态
    await _restoreAll();
  }

  /// App 销毁时调用
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ws.dispose();
  }

  // ====================== 监听器注册 ======================

  void addListener(LifecycleAware listener) {
    if (!_listeners.contains(listener)) _listeners.add(listener);
  }

  void removeListener(LifecycleAware listener) {
    _listeners.remove(listener);
  }

  // ====================== 生命周期回调 ======================

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _lastState = state;

    switch (state) {
      case AppLifecycleState.resumed:
        _onResumed();
        break;
      case AppLifecycleState.inactive:
        // iOS: 即将进入后台 / 来电等
        break;
      case AppLifecycleState.paused:
        _onPaused();
        break;
      case AppLifecycleState.detached:
        _onDetached();
        break;
      case AppLifecycleState.hidden:
        // Desktop / Web 最小化
        _onPaused();
        break;
    }
  }

  /// 前台恢复
  void _onResumed() {
    _ws.reconnect();
    for (final l in List<LifecycleAware>.from(_listeners)) {
      l.onResumed();
    }
  }

  /// 进入后台 — 保存状态、断开 WS
  Future<void> _onPaused() async {
    await _saveAll();
    _ws.disconnect();
  }

  /// 引擎即将销毁
  Future<void> _onDetached() async {
    await _saveAll();
    _ws.disconnect();
  }

  // ====================== 状态持久化 ======================

  static const _stateKey = 'app_saved_state';

  Future<void> _saveAll() async {
    final prefs = await SharedPreferences.getInstance();
    final state = <String, dynamic>{};

    for (final l in _listeners) {
      final s = l.saveState();
      if (s != null && s.isNotEmpty) {
        state[l.stateKey] = s;
      }
    }

    await prefs.setString(_stateKey, jsonEncode(state));
  }

  Future<void> _restoreAll() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_stateKey);
    if (raw == null) return;

    try {
      final state = jsonDecode(raw) as Map<String, dynamic>;
      for (final l in _listeners) {
        final s = state[l.stateKey];
        if (s is Map<String, dynamic>) {
          l.restoreState(s);
        }
      }
    } catch (_) {
      // 状态损坏，跳过
    }
  }

  /// 主动保存（可在关键操作后调用）
  Future<void> forceSave() => _saveAll();
}

/// 需要参与生命周期管理的 ViewModel 实现此接口
abstract mixin class LifecycleAware {
  /// 唯一键，用于在持久化 Map 中区分不同 ViewModel
  String get stateKey;

  /// App 回到前台时调用 — 刷新数据等
  void onResumed();

  /// 返回需要持久化的状态（返回 null 或空 Map 表示不保存）
  Map<String, dynamic>? saveState();

  /// 恢复之前保存的状态
  void restoreState(Map<String, dynamic> state);
}
