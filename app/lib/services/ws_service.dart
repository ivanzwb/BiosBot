import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../core/config/app_config.dart';

/// WebSocket 事件
class WsEvent {
  final String type;
  final dynamic payload;
  WsEvent({required this.type, required this.payload});
}

typedef WsListener = void Function(WsEvent event);

/// WebSocket 客户端 — 自动重连，事件监听
class WsService {
  static final WsService _instance = WsService._();
  factory WsService() => _instance;
  WsService._();

  WebSocketChannel? _channel;
  final List<WsListener> _listeners = [];
  Timer? _reconnectTimer;
  bool _disposed = false;

  String get _wsUrl {
    final base = AppConfig.apiBaseUrl;
    // 从 http://host:port/api → ws://host:port/ws
    final uri = Uri.parse(base);
    final scheme = uri.scheme == 'https' ? 'wss' : 'ws';
    return '$scheme://${uri.host}:${uri.port}/ws';
  }

  void connect() {
    if (_disposed) return;
    if (_channel != null) return;

    try {
      _channel = WebSocketChannel.connect(Uri.parse(_wsUrl));
      _channel!.stream.listen(
        (data) {
          try {
            final map = jsonDecode(data as String) as Map<String, dynamic>;
            final event = WsEvent(
              type: map['type'] as String? ?? '',
              payload: map['payload'],
            );
            for (final fn in List<WsListener>.from(_listeners)) {
              fn(event);
            }
          } catch (_) {}
        },
        onDone: () {
          _channel = null;
          _scheduleReconnect();
        },
        onError: (_) {
          _channel = null;
          _scheduleReconnect();
        },
      );
      _reconnectTimer?.cancel();
      _reconnectTimer = null;
    } catch (_) {
      _channel = null;
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    if (_disposed || _reconnectTimer != null) return;
    _reconnectTimer = Timer(const Duration(seconds: 3), () {
      _reconnectTimer = null;
      connect();
    });
  }

  /// 注册事件监听器，返回取消函数
  void Function() onEvent(WsListener listener) {
    _listeners.add(listener);
    if (_channel == null) connect();
    return () => _listeners.remove(listener);
  }

  /// 监听特定类型事件
  void Function() onEventType(String type, void Function(dynamic payload) listener) {
    return onEvent((event) {
      if (event.type == type) listener(event.payload);
    });
  }

  /// 主动断开（进入后台时调，不清除 listener）
  void disconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _channel?.sink.close();
    _channel = null;
  }

  /// 重新连接（回到前台时调）
  void reconnect() {
    _disposed = false;
    if (_channel == null) connect();
  }

  void dispose() {
    _disposed = true;
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _listeners.clear();
  }
}
