/// 应用全局配置
class AppConfig {
  /// 后端 API 基础地址
  static String apiBaseUrl = 'http://localhost:3000/api';

  /// 请求超时时间（毫秒）- 复杂任务需要更长时间
  static const int requestTimeout = 600000;

  /// 长任务轮询间隔（毫秒）
  static const int taskPollInterval = 2000;

  /// 应用名称
  static const String appName = 'BiosBot';
}
