import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../viewmodels/settings_viewmodel.dart';
import '../../../models/agent.dart';
import '../../../services/agent_service.dart';

/// 设置页面 — 模型管理 + Proxy Agent 配置(5 Tab)
class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final vm = context.read<SettingsViewModel>();
      vm.loadConfigs();
      vm.loadProxyExtras();
      vm.loadGlobalTools();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<SettingsViewModel>(
      builder: (context, vm, _) {
        if (vm.isLoading) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return Scaffold(
          appBar: AppBar(
            automaticallyImplyLeading: false,
            title: const Text('设置'),
          ),
          body: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              // ==================== 模型管理 ====================
              _SectionHeader(
                title: '模型管理',
                trailing: FilledButton.icon(
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('添加'),
                  onPressed: () => _showModelEditor(context, vm, null),
                ),
              ),
              const SizedBox(height: 8),
              if (vm.models.isEmpty)
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: Text('暂无模型，点击「添加」创建')),
                  ),
                )
              else
                ...vm.models.map((m) => _ModelCard(
                      model: m,
                      isDefault: m.id == vm.defaultModelId,
                      testResult: vm.getTestResult(m.id),
                      onEdit: () => _showModelEditor(context, vm, m),
                      onDelete: () => vm.deleteModel(m.id),
                      onSetDefault: () => vm.setDefaultModel(m.id),
                      onTest: () => vm.testModel(m),
                    )),
              const SizedBox(height: 32),
              const Divider(),
              const SizedBox(height: 16),

              // ==================== Proxy Agent ====================
              _SectionHeader(title: 'Proxy Agent 配置'),
              const SizedBox(height: 8),
              _ProxyAgentConfig(vm: vm),

              const SizedBox(height: 32),
              const Divider(),
              const SizedBox(height: 16),

              // ==================== 全局Tools ====================
              _SectionHeader(
                title: '全局Tools',
                trailing: FilledButton.icon(
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('添加'),
                  onPressed: () => _showGlobalToolEditor(context, vm, null),
                ),
              ),
              const SizedBox(height: 8),
              _GlobalToolsSection(vm: vm, onEdit: (tool) => _showGlobalToolEditor(context, vm, tool)),

              const SizedBox(height: 32),
              const Divider(),
              const SizedBox(height: 16),

              // ==================== 关于 ====================
              Card(
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.info_outline),
                      title: const Text('关于'),
                      subtitle: const Text('BiosBot v1.0.0'),
                    ),
                  ],
                ),
              ),

              if (vm.error != null) ...[
                const SizedBox(height: 16),
                Text(vm.error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
            ],
          ),
        );
      },
    );
  }

  void _showModelEditor(
      BuildContext context, SettingsViewModel vm, ModelProvider? existing) {
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final modelCtrl = TextEditingController(text: existing?.model ?? '');
    final keyCtrl = TextEditingController(text: existing?.apiKey ?? '');
    final urlCtrl = TextEditingController(text: existing?.baseUrl ?? '');
    final embedCtrl =
        TextEditingController(text: existing?.embeddingModel ?? '');
    bool obscureKey = true;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setBottomState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 20,
            right: 20,
            top: 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  existing != null ? '编辑模型' : '添加模型',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: nameCtrl,
                  decoration:
                      const InputDecoration(labelText: '名称 *', hintText: '如 GPT-4.1'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: modelCtrl,
                  decoration:
                      const InputDecoration(labelText: '模型 *', hintText: 'gpt-4.1-mini'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: keyCtrl,
                  obscureText: obscureKey,
                  decoration: InputDecoration(
                    labelText: 'API Key *',
                    hintText: 'sk-...',
                    suffixIcon: IconButton(
                      icon: Icon(obscureKey
                          ? Icons.visibility_off
                          : Icons.visibility),
                      onPressed: () =>
                          setBottomState(() => obscureKey = !obscureKey),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: urlCtrl,
                  decoration: const InputDecoration(
                    labelText: 'API URL',
                    hintText: 'https://api.openai.com/v1',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: embedCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Embedding Model',
                    hintText: '留空自动检测',
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('取消'),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () {
                        if (nameCtrl.text.trim().isEmpty ||
                            modelCtrl.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('名称和模型不能为空')),
                          );
                          return;
                        }
                        final m = ModelProvider(
                          id: existing?.id ??
                              'm_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}',
                          name: nameCtrl.text.trim(),
                          model: modelCtrl.text.trim(),
                          apiKey: keyCtrl.text.trim(),
                          baseUrl: urlCtrl.text.trim(),
                          embeddingModel: embedCtrl.text.trim().isEmpty
                              ? null
                              : embedCtrl.text.trim(),
                        );
                        if (existing != null) {
                          vm.updateModel(m);
                        } else {
                          vm.addModel(m);
                        }
                        Navigator.pop(ctx);
                      },
                      child: const Text('保存'),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showGlobalToolEditor(
      BuildContext context, SettingsViewModel vm, AgentTool? existing) {
    final idCtrl = TextEditingController(text: existing?.id ?? '');
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final descCtrl = TextEditingController(text: existing?.description ?? '');
    final urlCtrl = TextEditingController(
        text: existing?.handler['url'] as String? ?? '');
    String method = existing?.handler['method'] as String? ?? 'GET';
    String handlerType = existing?.handlerType ?? 'http';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setBottomState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 20, right: 20, top: 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  existing != null ? '编辑全局Tool' : '添加全局Tool',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  '全局Tools将对所有 Agent 生效',
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.outline,
                  ),
                ),
                const SizedBox(height: 16),
                if (existing == null)
                  TextField(
                    controller: idCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Tool ID *',
                      hintText: '如 weather-api',
                    ),
                  ),
                if (existing == null) const SizedBox(height: 12),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(
                    labelText: '名称 *',
                    hintText: 'LLM 调用时使用的名称',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: '描述 *',
                    hintText: '描述工具的功能，帮助 LLM 理解何时使用',
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Handler 类型', style: TextStyle(fontSize: 12)),
                const SizedBox(height: 4),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'http', label: Text('HTTP')),
                    ButtonSegment(value: 'script', label: Text('Script')),
                  ],
                  selected: {handlerType},
                  onSelectionChanged: (v) =>
                      setBottomState(() => handlerType = v.first),
                ),
                const SizedBox(height: 12),
                if (handlerType == 'http') ...[
                  Row(
                    children: [
                      SizedBox(
                        width: 100,
                        child: DropdownButtonFormField<String>(
                          value: method,
                          decoration:
                              const InputDecoration(labelText: 'Method'),
                          items: ['GET', 'POST', 'PUT', 'DELETE']
                              .map((m) =>
                                  DropdownMenuItem(value: m, child: Text(m)))
                              .toList(),
                          onChanged: (v) =>
                              setBottomState(() => method = v ?? 'GET'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: urlCtrl,
                          decoration: const InputDecoration(
                            labelText: 'URL *',
                            hintText: 'https://api.example.com/{{param}}',
                          ),
                        ),
                      ),
                    ],
                  ),
                ] else ...[
                  const Text(
                    '脚本类型工具需要先创建，然后上传脚本文件',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ],
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('取消'),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () async {
                        if (nameCtrl.text.trim().isEmpty ||
                            descCtrl.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('名称和描述不能为空')),
                          );
                          return;
                        }
                        if (existing == null && idCtrl.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Tool ID 不能为空')),
                          );
                          return;
                        }
                        if (handlerType == 'http' &&
                            urlCtrl.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('URL 不能为空')),
                          );
                          return;
                        }

                        final handler = handlerType == 'http'
                            ? {
                                'type': 'http',
                                'url': urlCtrl.text.trim(),
                                'method': method,
                              }
                            : {
                                'type': 'script',
                                'scriptFile': '',
                                'runtime': 'node',
                              };

                        if (existing != null) {
                          await vm.updateGlobalTool(
                            existing.id,
                            name: nameCtrl.text.trim(),
                            description: descCtrl.text.trim(),
                            handler: handler,
                          );
                        } else {
                          await vm.createGlobalTool(
                            id: idCtrl.text.trim(),
                            name: nameCtrl.text.trim(),
                            description: descCtrl.text.trim(),
                            handler: handler,
                          );
                        }
                        if (ctx.mounted) Navigator.pop(ctx);
                      },
                      child: const Text('保存'),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ===================== 组件 =====================

/// 全局Tools列表组件
class _GlobalToolsSection extends StatelessWidget {
  final SettingsViewModel vm;
  final void Function(AgentTool tool) onEdit;
  const _GlobalToolsSection({required this.vm, required this.onEdit});

  @override
  Widget build(BuildContext context) {
    if (vm.loadingGlobalTools) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    if (vm.globalTools.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.build_outlined, size: 48, color: Colors.grey),
                SizedBox(height: 8),
                Text('暂无全局Tools'),
                SizedBox(height: 4),
                Text(
                  '全局Tools可被所有 Agent 使用',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Card(
      child: Column(
        children: vm.globalTools.map((tool) => _GlobalToolTile(
          tool: tool,
          onEdit: () => onEdit(tool),
          onDelete: () => vm.deleteGlobalTool(tool.id),
          onToggle: () => vm.updateGlobalTool(tool.id, enabled: !tool.enabled),
        )).toList(),
      ),
    );
  }
}

/// 全局Tool条目
class _GlobalToolTile extends StatelessWidget {
  final AgentTool tool;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onToggle;

  const _GlobalToolTile({
    required this.tool,
    required this.onEdit,
    required this.onDelete,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(
        tool.handlerType == 'http' ? Icons.http : Icons.code,
        color: tool.enabled ? null : Colors.grey,
      ),
      title: Text(
        tool.name,
        style: TextStyle(
          color: tool.enabled ? null : Colors.grey,
        ),
      ),
      subtitle: Text(
        tool.description,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: tool.enabled ? null : Colors.grey,
        ),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Switch(
            value: tool.enabled,
            onChanged: (_) => onToggle(),
          ),
          IconButton(
            icon: const Icon(Icons.edit, size: 18),
            tooltip: '编辑',
            onPressed: onEdit,
          ),
          IconButton(
            icon: Icon(
              Icons.delete_outline,
              size: 18,
              color: Theme.of(context).colorScheme.error,
            ),
            tooltip: '删除',
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final Widget? trailing;
  const _SectionHeader({required this.title, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const Spacer(),
        if (trailing != null) trailing!,
      ],
    );
  }
}

/// 模型卡片
class _ModelCard extends StatelessWidget {
  final ModelProvider model;
  final bool isDefault;
  final Map<String, dynamic>? testResult;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onSetDefault;
  final VoidCallback onTest;

  const _ModelCard({
    required this.model,
    required this.isDefault,
    this.testResult,
    required this.onEdit,
    required this.onDelete,
    required this.onSetDefault,
    required this.onTest,
  });

  String _maskKey(String key) {
    if (key.isEmpty) return '未设置';
    if (key.length <= 8) return '••••••••';
    return '${key.substring(0, 3)}••••${key.substring(key.length - 4)}';
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(model.name,
                    style: Theme.of(context).textTheme.titleSmall),
                if (isDefault) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text('默认',
                        style: TextStyle(
                            fontSize: 10,
                            color: Theme.of(context).colorScheme.primary)),
                  ),
                ],
                const Spacer(),
                IconButton(
                    icon: const Icon(Icons.science, size: 20),
                    tooltip: '测试连通性',
                    onPressed: onTest),
                if (!isDefault)
                  IconButton(
                      icon: const Icon(Icons.star_outline, size: 20),
                      tooltip: '设为默认',
                      onPressed: onSetDefault),
                IconButton(
                    icon: const Icon(Icons.edit, size: 20),
                    tooltip: '编辑',
                    onPressed: onEdit),
                IconButton(
                    icon: Icon(Icons.delete_outline,
                        size: 20,
                        color: Theme.of(context).colorScheme.error),
                    tooltip: '删除',
                    onPressed: onDelete),
              ],
            ),
            // Test result
            if (testResult != null) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: testResult!['success'] == true
                      ? Colors.green.withValues(alpha: 0.1)
                      : Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  testResult!['success'] == true
                      ? '✅ 连通成功 (${testResult!['latency']}ms)'
                      : '❌ 连接失败: ${testResult!['message']}',
                  style: TextStyle(
                    fontSize: 12,
                    color: testResult!['success'] == true
                        ? Colors.green
                        : Colors.red,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 8),
            _MetaRow(label: '模型', value: model.model),
            if (model.baseUrl.isNotEmpty)
              _MetaRow(label: 'URL', value: model.baseUrl),
            _MetaRow(label: 'Key', value: _maskKey(model.apiKey)),
          ],
        ),
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  final String label;
  final String value;
  const _MetaRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          SizedBox(
            width: 50,
            child: Text(label,
                style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.outline)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(fontSize: 12),
                overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
    );
  }
}

/// Proxy Agent 配置（5 Tab）
class _ProxyAgentConfig extends StatefulWidget {
  final SettingsViewModel vm;
  const _ProxyAgentConfig({required this.vm});

  @override
  State<_ProxyAgentConfig> createState() => _ProxyAgentConfigState();
}

class _ProxyAgentConfigState extends State<_ProxyAgentConfig>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  late TextEditingController _classifyCtrl;
  late TextEditingController _aggregateCtrl;
  late double _temperature;
  late String _selectedModel;
  final _svc = AgentService();

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 5, vsync: this);
    _classifyCtrl =
        TextEditingController(text: widget.vm.proxyClassifyPrompt);
    _aggregateCtrl =
        TextEditingController(text: widget.vm.proxyAggregatePrompt);
    _temperature = widget.vm.proxyTemperature;
    _selectedModel = widget.vm.proxyModel;
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _classifyCtrl.dispose();
    _aggregateCtrl.dispose();
    super.dispose();
  }

  void _flash(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final vm = widget.vm;

    return Card(
      child: Column(
        children: [
          TabBar(
            controller: _tabCtrl,
            isScrollable: true,
            tabs: const [
              Tab(text: '基本配置'),
              Tab(text: 'Prompt'),
              Tab(text: 'Skills'),
              Tab(text: 'Tools'),
              Tab(text: '知识库'),
            ],
          ),
          SizedBox(
            height: 400,
            child: TabBarView(
              controller: _tabCtrl,
              children: [
                _buildBasicTab(vm),
                _buildPromptTab(vm),
                _buildSkillsTab(vm),
                _buildToolsTab(vm),
                _buildKbTab(vm),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // 基本配置
  Widget _buildBasicTab(SettingsViewModel vm) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DropdownButtonFormField<String>(
            value: _selectedModel.isEmpty ? null : _selectedModel,
            decoration: InputDecoration(
              labelText: '模型',
              hintText: vm.defaultModelId.isNotEmpty
                  ? '使用默认 (${vm.defaultModelId})'
                  : '使用默认模型',
            ),
            items: [
              const DropdownMenuItem(value: '', child: Text('使用默认')),
              ...vm.models.map((m) => DropdownMenuItem(
                    value: m.id,
                    child: Text('${m.name} (${m.model})'),
                  )),
            ],
            onChanged: (v) => setState(() => _selectedModel = v ?? ''),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              const Text('Temperature'),
              Expanded(
                child: Slider(
                  value: _temperature,
                  min: 0,
                  max: 1,
                  divisions: 10,
                  label: _temperature.toStringAsFixed(1),
                  onChanged: (v) => setState(() => _temperature = v),
                ),
              ),
              Text(_temperature.toStringAsFixed(1)),
            ],
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            icon: const Icon(Icons.save),
            label: const Text('保存'),
            onPressed: () => vm.saveProxyConfig(
              model: _selectedModel,
              temperature: _temperature,
            ),
          ),
        ],
      ),
    );
  }

  // Prompt
  Widget _buildPromptTab(SettingsViewModel vm) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('分类 Prompt（路由意图识别）',
              style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          TextField(
            controller: _classifyCtrl,
            maxLines: 5,
            decoration: const InputDecoration(
              hintText: '留空使用默认分类 Prompt',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          const Text('聚合 Prompt（合并多 Agent 回复）',
              style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          TextField(
            controller: _aggregateCtrl,
            maxLines: 5,
            decoration: const InputDecoration(
              hintText: '留空使用默认聚合 Prompt',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            icon: const Icon(Icons.save),
            label: const Text('保存'),
            onPressed: () => vm.saveProxyConfig(
              classifyPrompt: _classifyCtrl.text,
              aggregatePrompt: _aggregateCtrl.text,
            ),
          ),
        ],
      ),
    );
  }

  // Skills
  Widget _buildSkillsTab(SettingsViewModel vm) {
    if (vm.loadingSkills) {
      return const Center(child: CircularProgressIndicator());
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              Text('Skills (${vm.proxySkills.length})'),
              const Spacer(),
              TextButton.icon(
                icon: const Icon(Icons.add, size: 16),
                label: const Text('添加'),
                onPressed: () => _showSkillEditor(null),
              ),
            ],
          ),
        ),
        Expanded(
          child: vm.proxySkills.isEmpty
              ? const Center(child: Text('暂无 Skill'))
              : ListView.builder(
                  itemCount: vm.proxySkills.length,
                  itemBuilder: (context, i) {
                    final s = vm.proxySkills[i];
                    return ListTile(
                      dense: true,
                      title: Text(s.name),
                      subtitle: Text(s.description,
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit, size: 18),
                            onPressed: () => _showSkillEditor(s),
                          ),
                          IconButton(
                            icon: Icon(Icons.delete_outline,
                                size: 18,
                                color: Theme.of(context).colorScheme.error),
                            onPressed: () async {
                              await _svc.deleteSkill('proxy-agent', s.id);
                              vm.loadProxyExtras();
                            },
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  void _showSkillEditor(Skill? existing) {
    final idCtrl = TextEditingController(text: existing?.id ?? '');
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final descCtrl = TextEditingController(text: existing?.description ?? '');
    final contentCtrl = TextEditingController(text: existing?.content ?? '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
          left: 20, right: 20, top: 20,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (existing == null)
                TextField(
                    controller: idCtrl,
                    decoration: const InputDecoration(labelText: 'Skill ID')),
              if (existing == null) const SizedBox(height: 12),
              TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: '名称')),
              const SizedBox(height: 12),
              TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(labelText: '描述')),
              const SizedBox(height: 12),
              TextField(
                  controller: contentCtrl,
                  maxLines: 6,
                  decoration: const InputDecoration(
                      labelText: '内容', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('取消')),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: () async {
                      try {
                        if (existing != null) {
                          await _svc.updateSkill('proxy-agent', existing.id,
                              name: nameCtrl.text.trim(),
                              description: descCtrl.text.trim(),
                              content: contentCtrl.text.trim());
                        } else {
                          await _svc.createSkill('proxy-agent',
                              id: idCtrl.text.trim(),
                              name: nameCtrl.text.trim(),
                              description: descCtrl.text.trim(),
                              content: contentCtrl.text.trim());
                        }
                        _flash('已保存');
                        if (ctx.mounted) Navigator.pop(ctx);
                        widget.vm.loadProxyExtras();
                      } catch (e) {
                        _flash('保存失败: $e');
                      }
                    },
                    child: const Text('保存'),
                  ),
                ],
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  // Tools
  Widget _buildToolsTab(SettingsViewModel vm) {
    if (vm.loadingTools) {
      return const Center(child: CircularProgressIndicator());
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              Text('Tools (${vm.proxyTools.length})'),
              const Spacer(),
              TextButton.icon(
                icon: const Icon(Icons.add, size: 16),
                label: const Text('添加'),
                onPressed: () => _showToolEditor(null),
              ),
            ],
          ),
        ),
        Expanded(
          child: vm.proxyTools.isEmpty
              ? const Center(child: Text('暂无 Tool'))
              : ListView.builder(
                  itemCount: vm.proxyTools.length,
                  itemBuilder: (context, i) {
                    final t = vm.proxyTools[i];
                    return ListTile(
                      dense: true,
                      title: Text(t.name),
                      subtitle: Text(t.description,
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Switch(
                            value: t.enabled,
                            onChanged: (_) async {
                              await _svc.updateTool(
                                  'proxy-agent', t.id, {'enabled': !t.enabled});
                              vm.loadProxyExtras();
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.edit, size: 18),
                            onPressed: () => _showToolEditor(t),
                          ),
                          IconButton(
                            icon: Icon(Icons.delete_outline,
                                size: 18,
                                color: Theme.of(context).colorScheme.error),
                            onPressed: () async {
                              await _svc.deleteTool('proxy-agent', t.id);
                              vm.loadProxyExtras();
                            },
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  void _showToolEditor(AgentTool? existing) {
    final idCtrl = TextEditingController(text: existing?.id ?? '');
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final descCtrl = TextEditingController(text: existing?.description ?? '');
    final urlCtrl = TextEditingController(
        text: existing?.handler['url'] as String? ?? '');
    String method = existing?.handler['method'] as String? ?? 'GET';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setBottomState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 20, right: 20, top: 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (existing == null)
                  TextField(
                      controller: idCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Tool ID')),
                if (existing == null) const SizedBox(height: 12),
                TextField(
                    controller: nameCtrl,
                    decoration: const InputDecoration(labelText: '名称')),
                const SizedBox(height: 12),
                TextField(
                    controller: descCtrl,
                    maxLines: 2,
                    decoration: const InputDecoration(labelText: '描述')),
                const SizedBox(height: 12),
                Row(
                  children: [
                    SizedBox(
                      width: 100,
                      child: DropdownButtonFormField<String>(
                        value: method,
                        items: ['GET', 'POST', 'PUT', 'DELETE']
                            .map((m) =>
                                DropdownMenuItem(value: m, child: Text(m)))
                            .toList(),
                        onChanged: (v) =>
                            setBottomState(() => method = v ?? 'GET'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                          controller: urlCtrl,
                          decoration:
                              const InputDecoration(labelText: 'URL')),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('取消')),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () async {
                        final toolData = {
                          'id': existing?.id ?? idCtrl.text.trim(),
                          'name': nameCtrl.text.trim(),
                          'description': descCtrl.text.trim(),
                          'parameters': existing?.parameters
                                  .map((p) => p.toJson())
                                  .toList() ??
                              [],
                          'handler': {
                            'type': 'http',
                            'url': urlCtrl.text.trim(),
                            'method': method,
                          },
                          'enabled': existing?.enabled ?? true,
                        };
                        try {
                          if (existing != null) {
                            final fields =
                                Map<String, dynamic>.from(toolData);
                            fields.remove('id');
                            await _svc.updateTool(
                                'proxy-agent', existing.id, fields);
                          } else {
                            await _svc.createTool('proxy-agent', toolData);
                          }
                          _flash('已保存');
                          if (ctx.mounted) Navigator.pop(ctx);
                          widget.vm.loadProxyExtras();
                        } catch (e) {
                          _flash('保存失败: $e');
                        }
                      },
                      child: const Text('保存'),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // 知识库
  Widget _buildKbTab(SettingsViewModel vm) {
    if (vm.loadingDocs) {
      return const Center(child: CircularProgressIndicator());
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              Text('文档 (${vm.proxyDocs.length})'),
              const Spacer(),
              TextButton.icon(
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('刷新'),
                onPressed: () => vm.loadProxyExtras(),
              ),
              TextButton.icon(
                icon: const Icon(Icons.upload, size: 16),
                label: const Text('导入'),
                onPressed: () => _showImportDialog(),
              ),
            ],
          ),
        ),
        if (vm.proxyDocs.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                icon: Icon(Icons.delete_sweep,
                    size: 16, color: Theme.of(context).colorScheme.error),
                label: Text('清空知识库',
                    style: TextStyle(
                        color: Theme.of(context).colorScheme.error)),
                onPressed: () async {
                  await _svc.clearKnowledge('proxy-agent');
                  _flash('知识库已清空');
                  vm.loadProxyExtras();
                },
              ),
            ),
          ),
        Expanded(
          child: vm.proxyDocs.isEmpty
              ? const Center(child: Text('暂无文档'))
              : ListView.builder(
                  itemCount: vm.proxyDocs.length,
                  itemBuilder: (context, i) {
                    final d = vm.proxyDocs[i];
                    return ListTile(
                      dense: true,
                      leading: const Icon(Icons.description_outlined, size: 20),
                      title: Text(d.title),
                      subtitle: Text('${d.chunkCount} chunks'),
                      trailing: IconButton(
                        icon: Icon(Icons.delete_outline,
                            size: 18,
                            color: Theme.of(context).colorScheme.error),
                        onPressed: () async {
                          await _svc.deleteKnowledgeDoc(
                              'proxy-agent', d.docId);
                          _flash('已删除');
                          vm.loadProxyExtras();
                        },
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  void _showImportDialog() {
    final titleCtrl = TextEditingController();
    final contentCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
          left: 20, right: 20, top: 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(labelText: '文档标题')),
            const SizedBox(height: 12),
            TextField(
                controller: contentCtrl,
                maxLines: 8,
                decoration: const InputDecoration(
                    labelText: '文档内容', border: OutlineInputBorder())),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('取消')),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () async {
                    if (contentCtrl.text.trim().isEmpty) return;
                    try {
                      await _svc.ingestDocuments(
                        agentId: 'proxy-agent',
                        documents: [
                          {
                            'id':
                                'manual_${DateTime.now().millisecondsSinceEpoch}',
                            'title': titleCtrl.text.trim().isNotEmpty
                                ? titleCtrl.text.trim()
                                : '手动导入',
                            'content': contentCtrl.text,
                          }
                        ],
                      );
                      _flash('导入成功');
                      if (ctx.mounted) Navigator.pop(ctx);
                      Future.delayed(const Duration(seconds: 3),
                          () => widget.vm.loadProxyExtras());
                    } catch (e) {
                      _flash('导入失败: $e');
                    }
                  },
                  child: const Text('导入'),
                ),
              ],
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}

