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
  final _apiKeyController = TextEditingController();
  final _apiUrlController = TextEditingController();
  final _modelController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final vm = context.read<SettingsViewModel>();
      await vm.loadConfigs();
      _apiKeyController.text = vm.apiKey;
      _apiUrlController.text = vm.apiUrl;
      _modelController.text = vm.defaultModel;
    });
  }

  @override
  void dispose() {
    _apiKeyController.dispose();
    _apiUrlController.dispose();
    _modelController.dispose();
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
                // 模型配置
                Text('大模型配置',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Text(
                  '所有模型均通过 OpenAI 兼容 API 调用，配置统一的 API Key、API URL 和默认模型即可。',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.outline,
                      ),
                ),
                const SizedBox(height: 16),
                _ApiKeyField(
                  label: 'API Key',
                  controller: _apiKeyController,
                  hint: 'sk-...',
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _apiUrlController,
                  decoration: const InputDecoration(
                    labelText: 'API URL',
                    hintText: 'https://api.openai.com/v1（留空使用默认）',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _modelController,
                  decoration: const InputDecoration(
                    labelText: '默认模型',
                    hintText: 'gpt-4.1-mini',
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  icon: const Icon(Icons.save),
                  label: const Text('保存'),
                  onPressed: () async {
                    await vm.saveSettings(
                      apiKey: _apiKeyController.text,
                      apiUrl: _apiUrlController.text,
                      defaultModel: _modelController.text,
                    );
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('设置已保存')),
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
