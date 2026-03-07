import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/config/app_config.dart';

/// 通用 HTTP 客户端，封装对后端 API 的调用
class ApiClient {
  static final ApiClient _instance = ApiClient._();
  factory ApiClient() => _instance;
  ApiClient._();

  String get _baseUrl => AppConfig.apiBaseUrl;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

  Future<dynamic> get(String path,
      {Map<String, String>? queryParams}) async {
    final uri = Uri.parse('$_baseUrl$path')
        .replace(queryParameters: queryParams);
    final response = await http
        .get(uri, headers: _headers)
        .timeout(Duration(milliseconds: AppConfig.requestTimeout));
    return _handleResponse(response);
  }

  Future<dynamic> post(String path, {dynamic body}) async {
    final response = await http
        .post(
          Uri.parse('$_baseUrl$path'),
          headers: _headers,
          body: body != null ? jsonEncode(body) : null,
        )
        .timeout(Duration(milliseconds: AppConfig.requestTimeout));
    return _handleResponse(response);
  }

  Future<dynamic> put(String path, {dynamic body}) async {
    final response = await http
        .put(
          Uri.parse('$_baseUrl$path'),
          headers: _headers,
          body: body != null ? jsonEncode(body) : null,
        )
        .timeout(Duration(milliseconds: AppConfig.requestTimeout));
    return _handleResponse(response);
  }

  Future<dynamic> delete(String path) async {
    final response = await http
        .delete(Uri.parse('$_baseUrl$path'), headers: _headers)
        .timeout(Duration(milliseconds: AppConfig.requestTimeout));
    return _handleResponse(response);
  }

  /// 文件上传（multipart/form-data）
  Future<dynamic> uploadFile(String path, String fieldName, String filePath, String fileName) async {
    final request = http.MultipartRequest('POST', Uri.parse('$_baseUrl$path'));
    request.headers['Accept'] = 'application/json';
    request.files.add(await http.MultipartFile.fromPath(fieldName, filePath, filename: fileName));
    final streamedResponse = await request.send().timeout(Duration(milliseconds: AppConfig.requestTimeout));
    final response = await http.Response.fromStream(streamedResponse);
    return _handleResponse(response);
  }

  /// 从字节上传文件（multipart/form-data）
  Future<dynamic> uploadFileBytes(String path, String fieldName, List<int> bytes, String fileName) async {
    final request = http.MultipartRequest('POST', Uri.parse('$_baseUrl$path'));
    request.headers['Accept'] = 'application/json';
    request.files.add(http.MultipartFile.fromBytes(fieldName, bytes, filename: fileName));
    final streamedResponse = await request.send().timeout(Duration(milliseconds: AppConfig.requestTimeout));
    final response = await http.Response.fromStream(streamedResponse);
    return _handleResponse(response);
  }

  dynamic _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return null;
      return jsonDecode(response.body);
    }
    // 尝试解析后端错误
    String message = 'Request failed: ${response.statusCode}';
    try {
      final err = jsonDecode(response.body);
      message = err['message'] ?? message;
    } catch (_) {}
    throw ApiException(response.statusCode, message);
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);

  @override
  String toString() => 'ApiException($statusCode): $message';
}
