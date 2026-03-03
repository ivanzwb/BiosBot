import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../viewmodels/settings_viewmodel.dart';

/// 设置页面 — API Key 配置、模型管理等
class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _openaiController = TextEditingController();
  final _aliyunController = TextEditingController();
  final _baiduController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final vm = context.read<SettingsViewModel>();
      await vm.loadConfigs();
      _openaiController.text = vm.apiKeys['openai']?.toString() ?? '';
      _aliyunController.text = vm.apiKeys['aliyun']?.toString() ?? '';
      _baiduController.text = vm.apiKeys['baidu']?.toString() ?? '';
    });
  }

  @override
  void dispose() {
    _openaiController.dispose();
    _aliyunController.dispose();
    _baiduController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('设置'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/chat'),
        ),
      ),
      body: Consumer<SettingsViewModel>(
        builder: (context, vm, _) {
          if (vm.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // API Keys 配置
                Text('大模型 API Key 配置',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Text(
                  '在此配置各大模型供应商的 API Key，Agent 将使用这些 Key 调用对应的大模型服务。',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.outline,
                      ),
                ),
                const SizedBox(height: 16),
                _ApiKeyField(
                  label: 'OpenAI API Key',
                  controller: _openaiController,
                  hint: 'sk-...',
                ),
                const SizedBox(height: 12),
                _ApiKeyField(
                  label: '阿里云 API Key',
                  controller: _aliyunController,
                  hint: '输入阿里云 API Key',
                ),
                const SizedBox(height: 12),
                _ApiKeyField(
                  label: '百度 API Key',
                  controller: _baiduController,
                  hint: '输入百度 API Key',
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  icon: const Icon(Icons.save),
                  label: const Text('保存 API Keys'),
                  onPressed: () async {
                    final keys = <String, String>{};
                    if (_openaiController.text.isNotEmpty) {
                      keys['openai'] = _openaiController.text;
                    }
                    if (_aliyunController.text.isNotEmpty) {
                      keys['aliyun'] = _aliyunController.text;
                    }
                    if (_baiduController.text.isNotEmpty) {
                      keys['baidu'] = _baiduController.text;
                    }
                    await vm.saveApiKeys(keys);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('API Keys 已保存')),
                      );
                    }
                  },
                ),
                const SizedBox(height: 32),
                const Divider(),
                const SizedBox(height: 16),
                // 其他设置
                Text('其他设置',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 16),
                Card(
                  child: Column(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.color_lens_outlined),
                        title: const Text('主题'),
                        subtitle: const Text('跟随系统'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          // TODO: 主题切换
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.bug_report_outlined),
                        title: const Text('日志等级'),
                        subtitle: const Text('Debug'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          // TODO: 日志等级配置
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.info_outline),
                        title: const Text('关于'),
                        subtitle: const Text('CloudBrain v1.0.0'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          // TODO: 关于页面
                        },
                      ),
                    ],
                  ),
                ),
                if (vm.error != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    vm.error!,
                    style: TextStyle(
                        color: Theme.of(context).colorScheme.error),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ApiKeyField extends StatefulWidget {
  final String label;
  final TextEditingController controller;
  final String hint;

  const _ApiKeyField({
    required this.label,
    required this.controller,
    required this.hint,
  });

  @override
  State<_ApiKeyField> createState() => _ApiKeyFieldState();
}

class _ApiKeyFieldState extends State<_ApiKeyField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: widget.controller,
      obscureText: _obscure,
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: widget.hint,
        suffixIcon: IconButton(
          icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
          onPressed: () => setState(() => _obscure = !_obscure),
        ),
      ),
    );
  }
}
