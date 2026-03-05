import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../viewmodels/settings_viewmodel.dart';
import '../../../models/agent.dart';
import '../../../services/agent_service.dart';

/// 设置页面 — 分组可折叠布局
class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  // 控制各分组展开状态
  final Set<int> _expandedSections = {0}; // 默认展开第一个

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final vm = context.read<SettingsViewModel>();
      vm.loadConfigs();
      vm.loadProxyExtras();
      vm.loadGlobalTools();
      vm.loadMcpServers();
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
          body: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: ExpansionPanelList(
              elevation: 1,
              expandedHeaderPadding: const EdgeInsets.symmetric(vertical: 4),
              expansionCallback: (index, isExpanded) {
                setState(() {
                  if (isExpanded) {
                    _expandedSections.remove(index);
                  } else {
                    _expandedSections.add(index);
                  }
                });
              },
              children: [
                // ==================== 模型管理 ====================
                ExpansionPanel(
                  isExpanded: _expandedSections.contains(0),
                  canTapOnHeader: true,
                  headerBuilder: (context, isExpanded) => ListTile(
                    leading: const Icon(Icons.smart_toy_outlined),
                    title: Text('模型管理',
                        style: Theme.of(context).textTheme.titleMedium),
                    subtitle: Text('${vm.models.length} 个模型'),
                  ),
                  body: _buildModelsSection(vm),
                ),

                // ==================== Proxy Agent ====================
                ExpansionPanel(
                  isExpanded: _expandedSections.contains(1),
                  canTapOnHeader: true,
                  headerBuilder: (context, isExpanded) => ListTile(
                    leading: const Icon(Icons.hub_outlined),
                    title: Text('Proxy Agent',
                        style: Theme.of(context).textTheme.titleMedium),
                    subtitle: const Text('意图识别 / 任务路由配置'),
                  ),
                  body: _ProxyAgentConfig(vm: vm),
                ),

                // ==================== 全局Tools ====================
                ExpansionPanel(
                  isExpanded: _expandedSections.contains(2),
                  canTapOnHeader: true,
                  headerBuilder: (context, isExpanded) => ListTile(
                    leading: const Icon(Icons.handyman_outlined),
                    title: Text('全局Tools',
                        style: Theme.of(context).textTheme.titleMedium),
                    subtitle: Text('${vm.globalTools.length} 个工具'),
                  ),
                  body: _buildGlobalToolsSection(vm),
                ),

                // ==================== 全局MCP Server ====================
                ExpansionPanel(
                  isExpanded: _expandedSections.contains(3),
                  canTapOnHeader: true,
                  headerBuilder: (context, isExpanded) => ListTile(
                    leading: const Icon(Icons.dns_outlined),
                    title: Text('全局MCP Server',
                        style: Theme.of(context).textTheme.titleMedium),
                    subtitle: Text('${vm.mcpServers.length} 个服务器'),
                  ),
                  body: _buildMcpServersSection(vm),
                ),

                // ==================== 关于 ====================
                ExpansionPanel(
                  isExpanded: _expandedSections.contains(4),
                  canTapOnHeader: true,
                  headerBuilder: (context, isExpanded) => ListTile(
                    leading: const Icon(Icons.info_outline),
                    title: Text('关于',
                        style: Theme.of(context).textTheme.titleMedium),
                    subtitle: const Text('BiosBot v1.0.0'),
                  ),
                  body: const Padding(
                    padding: EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('BiosBot - AI Agent 平台'),
                        SizedBox(height: 8),
                        Text('版本: 1.0.0',
                            style: TextStyle(color: Colors.grey)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );

        // 显示提示
      },
    );
  }

  // ==================== 模型管理部分 ====================
  Widget _buildModelsSection(SettingsViewModel vm) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              FilledButton.icon(
                icon: const Icon(Icons.add, size: 18),
                label: const Text('添加'),
                onPressed: () => _showModelEditor(context, vm, null),
              ),
            ],
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
          if (vm.error != null) ...[
            const SizedBox(height: 16),
            Text(vm.error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
        ],
      ),
    );
  }

  // ==================== 全局Tools部分 ====================
  Widget _buildGlobalToolsSection(SettingsViewModel vm) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              FilledButton.icon(
                icon: const Icon(Icons.add, size: 18),
                label: const Text('添加'),
                onPressed: () => _showGlobalToolEditor(context, vm, null),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _GlobalToolsSection(
              vm: vm,
              onEdit: (tool) => _showGlobalToolEditor(context, vm, tool)),
        ],
      ),
    );
  }

  // ==================== 全局MCP Server部分 ====================
  Widget _buildMcpServersSection(SettingsViewModel vm) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              FilledButton.icon(
                icon: const Icon(Icons.add, size: 18),
                label: const Text('添加'),
                onPressed: () => _showMcpServerEditor(context, vm, null),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _McpServersSection(
              vm: vm,
              onEdit: (server) => _showMcpServerEditor(context, vm, server)),
        ],
      ),
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

  void _showMcpServerEditor(
      BuildContext context, SettingsViewModel vm, McpServerConfig? existing) {
    final idCtrl = TextEditingController(text: existing?.id ?? '');
    final commandCtrl = TextEditingController(text: existing?.command ?? '');
    final argsCtrl = TextEditingController(text: (existing?.args ?? []).join('\n'));
    final envCtrl = TextEditingController(
      text: (existing?.env ?? {}).entries.map((e) => '${e.key}=${e.value}').join('\n'),
    );
    final urlCtrl = TextEditingController(text: existing?.url ?? '');
    final headersCtrl = TextEditingController(
      text: (existing?.headers ?? {}).entries.map((e) => '${e.key}=${e.value}').join('\n'),
    );
    String serverType = existing?.type ?? 'local';

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
                  existing != null ? '编辑 MCP Server' : '添加 MCP Server',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  '通过 MCP 协议连接外部工具服务器',
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.outline,
                  ),
                ),
                const SizedBox(height: 16),
                if (existing == null) ...[
                  TextField(
                    controller: idCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Server ID *',
                      hintText: '如 filesystem',
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                // 服务器类型选择
                DropdownButtonFormField<String>(
                  value: serverType,
                  decoration: const InputDecoration(
                    labelText: '服务器类型',
                  ),
                  items: const [
                    DropdownMenuItem(value: 'local', child: Text('📦 本地 MCP Server（npm 包启动进程）')),
                    DropdownMenuItem(value: 'remote', child: Text('🌐 远程 MCP Server（SSE/HTTP 连接）')),
                  ],
                  onChanged: existing != null ? null : (value) {
                    setBottomState(() {
                      serverType = value ?? 'local';
                    });
                  },
                ),
                const SizedBox(height: 12),
                // 本地 MCP Server 配置
                if (serverType == 'local') ...[
                  // 安装 npm 包区域
                  _McpInstallSection(vm: vm, setBottomState: setBottomState),
                  const SizedBox(height: 12),
                  TextField(
                    controller: commandCtrl,
                    decoration: const InputDecoration(
                      labelText: '启动命令 *',
                      hintText: '如 npx',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: argsCtrl,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: '命令参数（每行一个）',
                      hintText: '-y\n@modelcontextprotocol/server-filesystem\nC:/Projects',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: envCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: '环境变量（每行 KEY=VALUE）',
                      hintText: 'API_KEY=your-key',
                    ),
                  ),
                ],
                // 远程 MCP Server 配置
                if (serverType == 'remote') ...[
                  TextField(
                    controller: urlCtrl,
                    decoration: const InputDecoration(
                      labelText: '服务器 URL *',
                      hintText: 'https://mcp.example.com/sse',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: headersCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: '请求头（每行 KEY=VALUE，用于认证等）',
                      hintText: 'Authorization=Bearer your-token',
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '🌐 远程 MCP Server 通过 SSE (Server-Sent Events) 协议连接。',
                    style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.outline),
                  ),
                ],
                // 测试结果显示
                if (vm.mcpTestResult != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: vm.mcpTestResult!.success
                          ? Colors.green.shade100
                          : Colors.red.shade100,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: vm.mcpTestResult!.success ? Colors.green : Colors.red,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              vm.mcpTestResult!.success ? Icons.check_circle : Icons.error,
                              color: vm.mcpTestResult!.success ? Colors.green : Colors.red,
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              vm.mcpTestResult!.success ? '测试成功！' : '测试失败',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: vm.mcpTestResult!.success ? Colors.green.shade700 : Colors.red.shade700,
                              ),
                            ),
                          ],
                        ),
                        if (vm.mcpTestResult!.success && vm.mcpTestResult!.tools.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            '检测到 ${vm.mcpTestResult!.tools.length} 个可用 Tools：',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                          ),
                          const SizedBox(height: 4),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: vm.mcpTestResult!.tools.map((tool) => Chip(
                              label: Text(tool.name, style: const TextStyle(fontSize: 10)),
                              tooltip: tool.description,
                              visualDensity: VisualDensity.compact,
                              backgroundColor: Colors.green.shade200,
                            )).toList(),
                          ),
                        ],
                        if (!vm.mcpTestResult!.success && vm.mcpTestResult!.error != null) ...[
                          const SizedBox(height: 8),
                          Text(
                            vm.mcpTestResult!.error!,
                            style: TextStyle(fontSize: 12, color: Colors.red.shade700),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    // 测试按钮
                    OutlinedButton.icon(
                      onPressed: vm.testingMcpServer
                          ? null
                          : () async {
                              final serverId = existing?.id ?? idCtrl.text.trim();
                              if (serverId.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('请先填写 Server ID')),
                                );
                                return;
                              }
                              if (serverType == 'local' && commandCtrl.text.trim().isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('本地 MCP Server 需要填写启动命令')),
                                );
                                return;
                              }
                              if (serverType == 'remote' && urlCtrl.text.trim().isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('远程 MCP Server 需要填写 URL')),
                                );
                                return;
                              }

                              final args = argsCtrl.text
                                  .split('\n')
                                  .map((s) => s.trim())
                                  .where((s) => s.isNotEmpty)
                                  .toList();
                              final env = <String, String>{};
                              for (final line in envCtrl.text.split('\n')) {
                                final idx = line.indexOf('=');
                                if (idx > 0) {
                                  env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
                                }
                              }
                              final headers = <String, String>{};
                              for (final line in headersCtrl.text.split('\n')) {
                                final idx = line.indexOf('=');
                                if (idx > 0) {
                                  headers[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
                                }
                              }

                              final testConfig = McpServerConfig(
                                id: serverId,
                                type: serverType,
                                enabled: true,
                                command: serverType == 'local' ? commandCtrl.text.trim() : null,
                                args: serverType == 'local' ? args : [],
                                env: serverType == 'local' ? env : {},
                                url: serverType == 'remote' ? urlCtrl.text.trim() : null,
                                headers: serverType == 'remote' ? headers : {},
                              );

                              setBottomState(() {});
                              await vm.testMcpServer(testConfig);
                              setBottomState(() {});
                            },
                      icon: vm.testingMcpServer
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.play_arrow, size: 18),
                      label: Text(vm.testingMcpServer ? '测试中...' : '测试连接'),
                    ),
                    const SizedBox(width: 8),
                    TextButton(
                      onPressed: () {
                        vm.clearMcpTestResult();
                        Navigator.pop(ctx);
                      },
                      child: const Text('取消'),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () async {
                        if (existing == null && idCtrl.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Server ID 不能为空')),
                          );
                          return;
                        }
                        if (serverType == 'local' && commandCtrl.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('本地 MCP Server 需要填写启动命令')),
                          );
                          return;
                        }
                        if (serverType == 'remote' && urlCtrl.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('远程 MCP Server 需要填写 URL')),
                          );
                          return;
                        }

                        final args = argsCtrl.text
                            .split('\n')
                            .map((s) => s.trim())
                            .where((s) => s.isNotEmpty)
                            .toList();
                        final env = <String, String>{};
                        for (final line in envCtrl.text.split('\n')) {
                          final idx = line.indexOf('=');
                          if (idx > 0) {
                            env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
                          }
                        }
                        final headers = <String, String>{};
                        for (final line in headersCtrl.text.split('\n')) {
                          final idx = line.indexOf('=');
                          if (idx > 0) {
                            headers[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
                          }
                        }

                        final configData = <String, dynamic>{
                          'type': serverType,
                          if (serverType == 'local') ...{
                            'command': commandCtrl.text.trim(),
                            'args': args,
                            'env': env,
                          },
                          if (serverType == 'remote') ...{
                            'url': urlCtrl.text.trim(),
                            'headers': headers,
                          },
                        };

                        if (existing != null) {
                          await vm.updateMcpServer(existing.id, configData);
                        } else {
                          await vm.createMcpServer(
                            id: idCtrl.text.trim(),
                            type: serverType,
                            command: serverType == 'local' ? commandCtrl.text.trim() : null,
                            args: serverType == 'local' ? args : null,
                            env: serverType == 'local' ? env : null,
                            url: serverType == 'remote' ? urlCtrl.text.trim() : null,
                            headers: serverType == 'remote' ? headers : null,
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

  void _showMcpPackageInstaller(BuildContext context, SettingsViewModel vm) {
    final packageCtrl = TextEditingController();
    final registryCtrl = TextEditingController();

    vm.clearMcpInstallError();
    vm.clearMcpProbeState();
    vm.loadInstalledMcpPackages();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => ListenableBuilder(
        listenable: vm,
        builder: (ctx, _) => Padding(
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
                  '📦 安装 MCP Server 包',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  '从 npm 安装 MCP Server 依赖包',
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.outline,
                  ),
                ),
                // 显示错误消息
                if (vm.mcpInstallError != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Theme.of(context).colorScheme.error),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '❌ 安装失败',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).colorScheme.onErrorContainer,
                          ),
                        ),
                        const SizedBox(height: 4),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 100),
                          child: SingleChildScrollView(
                            child: Text(
                              vm.mcpInstallError!,
                              style: TextStyle(
                                fontSize: 12,
                                color: Theme.of(context).colorScheme.onErrorContainer,
                              ),
                            ),
                          ),
                        ),
                        // 详细 npm 日志
                        if (vm.mcpInstallNpmLog != null) ...[
                          const SizedBox(height: 8),
                          ExpansionTile(
                            title: const Text(
                              '查看详细 npm 日志',
                              style: TextStyle(fontSize: 12),
                            ),
                            tilePadding: EdgeInsets.zero,
                            childrenPadding: const EdgeInsets.only(top: 8),
                            children: [
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: Colors.grey[900],
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: ConstrainedBox(
                                  constraints: const BoxConstraints(maxHeight: 200),
                                  child: SingleChildScrollView(
                                    child: SelectableText(
                                      vm.mcpInstallNpmLog!,
                                      style: const TextStyle(
                                        fontSize: 10,
                                        fontFamily: 'monospace',
                                        color: Colors.white70,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
                // 探测中
                if (vm.probingMcpTools) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade100,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.amber),
                    ),
                    child: const Row(
                      children: [
                        SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        SizedBox(width: 12),
                        Text('🔍 正在检测 MCP Tools...'),
                      ],
                    ),
                  ),
                ],
                // 探测成功显示 tools
                if (vm.probedMcpTools.isNotEmpty && vm.probedMcpPackage != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.green.shade100,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.green),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '✅ ${vm.probedMcpPackage} 安装成功！',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '检测到 ${vm.probedMcpTools.length} 个可用 Tools：',
                          style: const TextStyle(fontSize: 12),
                        ),
                        const SizedBox(height: 4),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 150),
                          child: SingleChildScrollView(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: vm.probedMcpTools.map((tool) => Padding(
                                padding: const EdgeInsets.symmetric(vertical: 2),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                      decoration: BoxDecoration(
                                        color: Colors.green.shade700,
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        tool.name,
                                        style: const TextStyle(
                                          fontSize: 11,
                                          fontFamily: 'monospace',
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                    if (tool.description != null) ...[
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          '— ${tool.description}',
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: Colors.green.shade900,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              )).toList(),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '⬆️ 请在「添加 MCP Server」中配置此包以启用这些 Tools',
                          style: TextStyle(fontSize: 11, color: Colors.green.shade800),
                        ),
                      ],
                    ),
                  ),
                ],
                // 探测失败
                if (vm.mcpProbeError != null && vm.probedMcpTools.isEmpty) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade100,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.amber),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '⚠️ 包已安装，但 Tools 探测失败',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          vm.mcpProbeError!,
                          style: const TextStyle(fontSize: 12),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          '这可能是因为该 MCP Server 需要特定的启动参数。请在「添加 MCP Server」中手动配置。',
                          style: TextStyle(fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                TextField(
                  controller: packageCtrl,
                  decoration: const InputDecoration(
                    labelText: '包名 *',
                    hintText: '@modelcontextprotocol/server-filesystem',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: registryCtrl,
                  decoration: const InputDecoration(
                    labelText: 'npm Registry（可选）',
                    hintText: 'https://registry.npmjs.org',
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  '常用 MCP Server 包:\n'
                  '• @modelcontextprotocol/server-filesystem（文件系统）\n'
                  '• @modelcontextprotocol/server-github（GitHub）\n'
                  '• @modelcontextprotocol/server-puppeteer（浏览器自动化）',
                  style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.outline),
                ),
                if (vm.installedMcpPackages.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    '已安装的 MCP 相关包:',
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.outline,
                    ),
                  ),
                  const SizedBox(height: 4),
                  ...vm.installedMcpPackages.map((pkg) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Text(
                      '• ${pkg.name} (${pkg.version})',
                      style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
                    ),
                  )),
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
                      onPressed: vm.installingMcpPackage || vm.probingMcpTools
                          ? null
                          : () async {
                              if (packageCtrl.text.trim().isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('包名不能为空')),
                                );
                                return;
                              }
                              await vm.installMcpPackage(
                                packageCtrl.text.trim(),
                                registry: registryCtrl.text.trim().isNotEmpty
                                    ? registryCtrl.text.trim()
                                    : null,
                              );
                              // 安装后不关闭弹窗，让用户看到探测结果
                            },
                      child: vm.installingMcpPackage || vm.probingMcpTools
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('安装'),
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
    _tabCtrl = TabController(length: 6, vsync: this);
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
              Tab(text: 'MCP Server'),
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
                _buildMcpTab(vm),
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

  // MCP Server
  Widget _buildMcpTab(SettingsViewModel vm) {
    final servers = vm.proxyMcpServers;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              Text('MCP Server (${servers.length})',
                  style: Theme.of(context).textTheme.titleSmall),
              const Spacer(),
              FilledButton.icon(
                icon: const Icon(Icons.add, size: 16),
                label: const Text('添加'),
                onPressed: () => _showProxyMcpServerEditor(null),
              ),
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            '此处配置的 MCP Server 仅供 Proxy Agent 使用。',
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: servers.isEmpty
              ? const Center(child: Text('暂无 MCP Server 配置'))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: servers.length,
                  itemBuilder: (context, i) {
                    final server = servers[i];
                    final isExpanded =
                        vm.proxyMcpServerTools.containsKey(server.id);
                    final tools = vm.proxyMcpServerTools[server.id] ?? [];
                    final loading = vm.loadingProxyMcpTools[server.id] ?? false;

                    return Card(
                      child: Column(
                        children: [
                          ListTile(
                            leading: Icon(
                              server.isRemote ? Icons.cloud : Icons.storage,
                              color: server.enabled
                                  ? Theme.of(context).colorScheme.primary
                                  : Colors.grey,
                            ),
                            title: Row(
                              children: [
                                Expanded(child: Text(server.id)),
                                if (!server.enabled)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.grey[200],
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text('已禁用',
                                        style: TextStyle(fontSize: 10)),
                                  ),
                              ],
                            ),
                            subtitle: Text(
                              server.isRemote
                                  ? server.url ?? ''
                                  : '${server.command ?? ''} ${server.args.take(2).join(' ')}${server.args.length > 2 ? '...' : ''}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: loading
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(
                                              strokeWidth: 2),
                                        )
                                      : const Icon(Icons.build, size: 20),
                                  onPressed: server.enabled
                                      ? () => _loadProxyMcpServerTools(server)
                                      : null,
                                  tooltip: '查看工具',
                                ),
                                Switch(
                                  value: server.enabled,
                                  onChanged: (_) =>
                                      _toggleProxyMcpServer(server),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.edit, size: 20),
                                  onPressed: () =>
                                      _showProxyMcpServerEditor(server),
                                ),
                                IconButton(
                                  icon: Icon(Icons.delete_outline,
                                      size: 20,
                                      color:
                                          Theme.of(context).colorScheme.error),
                                  onPressed: () =>
                                      _deleteProxyMcpServer(server.id),
                                ),
                              ],
                            ),
                          ),
                          if (isExpanded && tools.isNotEmpty)
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                              child: Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                children: tools
                                    .map((tool) => Chip(
                                          label: Text(tool.name,
                                              style:
                                                  const TextStyle(fontSize: 12)),
                                          backgroundColor: Theme.of(context)
                                              .colorScheme
                                              .primaryContainer,
                                          visualDensity: VisualDensity.compact,
                                        ))
                                    .toList(),
                              ),
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

  void _showProxyMcpServerEditor(McpServerConfig? existing) {
    final idCtrl = TextEditingController(text: existing?.id ?? '');
    String type = existing?.type ?? 'local';
    bool enabled = existing?.enabled ?? true;
    final commandCtrl = TextEditingController(text: existing?.command ?? '');
    final argsCtrl =
        TextEditingController(text: existing?.args.join('\n') ?? '');
    final envCtrl = TextEditingController(
        text: existing?.env.entries.map((e) => '${e.key}=${e.value}').join('\n') ??
            '');
    final urlCtrl = TextEditingController(text: existing?.url ?? '');
    final headersCtrl = TextEditingController(
        text: existing?.headers.entries
                .map((e) => '${e.key}: ${e.value}')
                .join('\n') ??
            '');

    // npm install state (for local MCP)
    bool installExpanded = false;
    bool installing = false;
    String? installError;
    List<InstalledMcpPackage> installedPackages = [];
    List<McpToolInfo> probedTools = [];
    String? probedPackage;
    String? probeError;
    bool probing = false;
    final packageCtrl = TextEditingController();

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
                Text(existing != null ? '编辑 MCP Server' : '添加 MCP Server',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 16),
                if (existing == null)
                  TextField(
                    controller: idCtrl,
                    decoration: const InputDecoration(labelText: 'Server ID *'),
                  ),
                if (existing == null) const SizedBox(height: 12),
                SwitchListTile(
                  title: const Text('启用'),
                  value: enabled,
                  onChanged: (v) => setBottomState(() => enabled = v),
                  contentPadding: EdgeInsets.zero,
                ),
                const SizedBox(height: 12),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'local', label: Text('📦 本地')),
                    ButtonSegment(value: 'remote', label: Text('🌐 远程')),
                  ],
                  selected: {type},
                  onSelectionChanged: (v) =>
                      setBottomState(() => type = v.first),
                ),
                const SizedBox(height: 16),
                if (type == 'local') ...[
                  // npm包安装区域（仅新增时显示）
                  if (existing == null) ...[
                    Container(
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primaryContainer.withOpacity(0.3),
                        border: Border.all(color: Theme.of(context).colorScheme.primary.withOpacity(0.5)),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '📦 安装 npm 包（可选）',
                                style: TextStyle(
                                  fontWeight: FontWeight.w500,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                              ),
                              TextButton(
                                onPressed: () async {
                                  setBottomState(() => installExpanded = !installExpanded);
                                  if (installExpanded) {
                                    try {
                                      final pkgs = await widget.vm.loadInstalledMcpPackages();
                                      setBottomState(() => installedPackages = pkgs);
                                    } catch (_) {}
                                  }
                                },
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                  minimumSize: Size.zero,
                                ),
                                child: Text(installExpanded ? '收起' : '展开', style: const TextStyle(fontSize: 12)),
                              ),
                            ],
                          ),
                          if (installExpanded) ...[
                            const SizedBox(height: 12),
                            // 错误提示
                            if (installError != null)
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                margin: const EdgeInsets.only(bottom: 12),
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.errorContainer,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text('❌ $installError',
                                    style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12)),
                              ),
                            // 正在探测
                            if (probing)
                              Container(
                                padding: const EdgeInsets.all(8),
                                margin: const EdgeInsets.only(bottom: 12),
                                child: const Row(
                                  children: [
                                    SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                                    SizedBox(width: 8),
                                    Text('🔍 正在检测 Tools...'),
                                  ],
                                ),
                              ),
                            // 探测成功
                            if (probedTools.isNotEmpty && probedPackage != null)
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                margin: const EdgeInsets.only(bottom: 12),
                                decoration: BoxDecoration(
                                  color: Colors.green.shade100,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: Colors.green),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('✅ $probedPackage 安装成功！',
                                        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green)),
                                    const SizedBox(height: 4),
                                    Wrap(
                                      spacing: 4,
                                      runSpacing: 4,
                                      children: probedTools.map((t) => Chip(
                                        label: Text(t.name, style: const TextStyle(fontSize: 10)),
                                        visualDensity: VisualDensity.compact,
                                      )).toList(),
                                    ),
                                  ],
                                ),
                              ),
                            // 探测失败
                            if (probeError != null && !probing)
                              Container(
                                padding: const EdgeInsets.all(8),
                                margin: const EdgeInsets.only(bottom: 12),
                                decoration: BoxDecoration(
                                  color: Colors.amber.shade100,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text('⚠️ $probeError', style: const TextStyle(fontSize: 12, color: Colors.brown)),
                              ),
                            // 安装输入
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: packageCtrl,
                                    decoration: const InputDecoration(
                                      isDense: true,
                                      hintText: '包名，如 @modelcontextprotocol/server-filesystem',
                                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                    ),
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                FilledButton(
                                  onPressed: installing ? null : () async {
                                    if (packageCtrl.text.trim().isEmpty) return;
                                    setBottomState(() {
                                      installing = true;
                                      installError = null;
                                      probeError = null;
                                      probedTools = [];
                                      probedPackage = null;
                                    });
                                    try {
                                      final result = await widget.vm.installMcpPackage(packageCtrl.text.trim());
                                      if (result.success) {
                                        // 探测 tools
                                        setBottomState(() => probing = true);
                                        try {
                                          final probeResult = await widget.vm.probeMcpPackageTools(result.packageName);
                                          if (probeResult.success && probeResult.tools.isNotEmpty) {
                                            setBottomState(() {
                                              probedTools = probeResult.tools;
                                              probedPackage = result.packageName;
                                            });
                                          } else {
                                            setBottomState(() => probeError = probeResult.error ?? '未检测到 Tools');
                                          }
                                        } catch (e) {
                                          setBottomState(() => probeError = e.toString());
                                        } finally {
                                          setBottomState(() => probing = false);
                                        }
                                        // 刷新已安装列表
                                        try {
                                          final pkgs = await widget.vm.loadInstalledMcpPackages();
                                          setBottomState(() => installedPackages = pkgs);
                                        } catch (_) {}
                                        packageCtrl.clear();
                                      } else {
                                        setBottomState(() => installError = result.stderr ?? result.message ?? '安装失败');
                                      }
                                    } catch (e) {
                                      setBottomState(() => installError = e.toString());
                                    } finally {
                                      setBottomState(() => installing = false);
                                    }
                                  },
                                  child: installing
                                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                      : const Text('安装'),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text('常用: @modelcontextprotocol/server-filesystem',
                                style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.outline)),
                            // 已安装列表
                            if (installedPackages.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              ExpansionTile(
                                title: Text('已安装的 MCP 包 (${installedPackages.length})',
                                    style: const TextStyle(fontSize: 12)),
                                tilePadding: EdgeInsets.zero,
                                childrenPadding: const EdgeInsets.only(left: 16),
                                children: installedPackages.map((pkg) => ListTile(
                                  dense: true,
                                  title: Text(pkg.name, style: const TextStyle(fontSize: 12)),
                                  trailing: Text(pkg.version, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                )).toList(),
                              ),
                            ],
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  TextField(
                    controller: commandCtrl,
                    decoration: const InputDecoration(labelText: '启动命令 *'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: argsCtrl,
                    decoration: const InputDecoration(
                      labelText: '命令参数（每行一个）',
                      hintText: '-y\n@anthropic/mcp-server-xxx',
                    ),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: envCtrl,
                    decoration: const InputDecoration(
                      labelText: '环境变量（KEY=VALUE 每行一个）',
                      hintText: 'API_KEY=xxx',
                    ),
                    maxLines: 2,
                  ),
                ] else ...[
                  TextField(
                    controller: urlCtrl,
                    decoration: const InputDecoration(labelText: '远程 URL *'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: headersCtrl,
                    decoration: const InputDecoration(
                      labelText: '请求头（KEY: VALUE 每行一个）',
                      hintText: 'Authorization: Bearer xxx',
                    ),
                    maxLines: 2,
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
                        final id = existing?.id ?? idCtrl.text.trim();
                        if (id.isEmpty) {
                          _flash('Server ID 不能为空');
                          return;
                        }
                        if (type == 'local' && commandCtrl.text.trim().isEmpty) {
                          _flash('启动命令不能为空');
                          return;
                        }
                        if (type == 'remote' && urlCtrl.text.trim().isEmpty) {
                          _flash('远程 URL 不能为空');
                          return;
                        }

                        final args = argsCtrl.text
                            .split('\n')
                            .map((s) => s.trim())
                            .where((s) => s.isNotEmpty)
                            .toList();

                        final env = <String, String>{};
                        for (final line in envCtrl.text.split('\n')) {
                          final idx = line.indexOf('=');
                          if (idx > 0) {
                            env[line.substring(0, idx).trim()] =
                                line.substring(idx + 1).trim();
                          }
                        }

                        final headers = <String, String>{};
                        for (final line in headersCtrl.text.split('\n')) {
                          final idx = line.indexOf(':');
                          if (idx > 0) {
                            headers[line.substring(0, idx).trim()] =
                                line.substring(idx + 1).trim();
                          }
                        }

                        final newServer = McpServerConfig(
                          id: id,
                          type: type,
                          enabled: enabled,
                          command:
                              type == 'local' ? commandCtrl.text.trim() : null,
                          args: type == 'local' ? args : [],
                          env: type == 'local' ? env : {},
                          url: type == 'remote' ? urlCtrl.text.trim() : null,
                          headers: type == 'remote' ? headers : {},
                        );

                        final vm = widget.vm;
                        final servers = List<McpServerConfig>.from(vm.proxyMcpServers);
                        if (existing != null) {
                          final idx = servers.indexWhere((s) => s.id == existing.id);
                          if (idx >= 0) servers[idx] = newServer;
                        } else {
                          if (servers.any((s) => s.id == id)) {
                            _flash('Server ID 已存在');
                            return;
                          }
                          servers.add(newServer);
                        }

                        await vm.saveProxyConfig(mcpServers: servers);
                        Navigator.pop(ctx);
                        _flash(existing != null ? 'MCP Server 已更新' : 'MCP Server 已添加');
                      },
                      child: Text(existing != null ? '更新' : '添加'),
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

  void _toggleProxyMcpServer(McpServerConfig server) async {
    final vm = widget.vm;
    final servers = List<McpServerConfig>.from(vm.proxyMcpServers);
    final idx = servers.indexWhere((s) => s.id == server.id);
    if (idx >= 0) {
      servers[idx] = server.copyWith(enabled: !server.enabled);
      await vm.saveProxyConfig(mcpServers: servers);
    }
  }

  Future<void> _deleteProxyMcpServer(String serverId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('确认删除'),
        content: const Text('确定删除此 MCP Server？'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('删除')),
        ],
      ),
    );
    if (confirm == true) {
      final vm = widget.vm;
      final servers = List<McpServerConfig>.from(vm.proxyMcpServers);
      servers.removeWhere((s) => s.id == serverId);
      vm.proxyMcpServerTools.remove(serverId);
      await vm.saveProxyConfig(mcpServers: servers);
      _flash('MCP Server 已删除');
    }
  }

  Future<void> _loadProxyMcpServerTools(McpServerConfig server) async {
    final vm = widget.vm;
    if (vm.proxyMcpServerTools.containsKey(server.id)) {
      setState(() {
        vm.proxyMcpServerTools.remove(server.id);
      });
      return;
    }

    setState(() {
      vm.loadingProxyMcpTools[server.id] = true;
    });

    try {
      final result = await _svc.testMcpServer(server);
      if (result.success) {
        setState(() {
          vm.proxyMcpServerTools[server.id] = result.tools;
        });
      } else {
        _flash('获取工具失败: ${result.error ?? '未知错误'}');
      }
    } catch (e) {
      _flash('获取工具失败: $e');
    } finally {
      setState(() {
        vm.loadingProxyMcpTools[server.id] = false;
      });
    }
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

/// MCP Server 列表组件
class _McpServersSection extends StatelessWidget {
  final SettingsViewModel vm;
  final void Function(McpServerConfig server) onEdit;
  const _McpServersSection({required this.vm, required this.onEdit});

  @override
  Widget build(BuildContext context) {
    if (vm.loadingMcpServers) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    if (vm.mcpServers.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.cable_outlined, size: 48, color: Colors.grey),
                SizedBox(height: 8),
                Text('暂无 MCP Server'),
                SizedBox(height: 4),
                Text(
                  '通过 MCP 协议连接外部工具服务器',
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
        children: vm.mcpServers.map((server) => _McpServerTile(
          server: server,
          tools: vm.mcpServerTools[server.id] ?? [],
          loadingTools: vm.loadingMcpTools[server.id] ?? false,
          onEdit: () => onEdit(server),
          onDelete: () => vm.deleteMcpServer(server.id),
          onToggle: () => vm.updateMcpServer(server.id, {'enabled': !server.enabled}),
          onLoadTools: () => vm.loadMcpServerTools(server.id),
        )).toList(),
      ),
    );
  }
}

/// MCP Server 条目
class _McpServerTile extends StatefulWidget {
  final McpServerConfig server;
  final List<McpTool> tools;
  final bool loadingTools;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onToggle;
  final VoidCallback onLoadTools;

  const _McpServerTile({
    required this.server,
    required this.tools,
    required this.loadingTools,
    required this.onEdit,
    required this.onDelete,
    required this.onToggle,
    required this.onLoadTools,
  });

  @override
  State<_McpServerTile> createState() => _McpServerTileState();
}

class _McpServerTileState extends State<_McpServerTile> {
  bool _toolsExpanded = false;

  @override
  void didUpdateWidget(_McpServerTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    // 工具列表有变化时自动展开
    if (widget.tools.isNotEmpty && oldWidget.tools.isEmpty) {
      setState(() => _toolsExpanded = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final server = widget.server;
    final tools = widget.tools;
    final loadingTools = widget.loadingTools;
    final isRemote = server.type == 'remote';
    return Column(
      children: [
        ListTile(
          leading: Icon(
            isRemote ? Icons.cloud_outlined : Icons.inventory_2_outlined,
            color: server.enabled ? null : Colors.grey,
          ),
          title: Row(
            children: [
              Text(
                server.id,
                style: TextStyle(
                  color: server.enabled ? null : Colors.grey,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: isRemote ? Colors.blue.withAlpha(30) : Colors.green.withAlpha(30),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  isRemote ? '远程' : '本地',
                  style: TextStyle(
                    fontSize: 10,
                    color: isRemote ? Colors.blue : Colors.green,
                  ),
                ),
              ),
            ],
          ),
          subtitle: Text(
            isRemote
                ? server.url ?? ''
                : '${server.command ?? ''} ${server.args.take(2).join(" ")}${server.args.length > 2 ? "..." : ""}',
            style: const TextStyle(fontSize: 12),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: loadingTools
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        tools.isNotEmpty && _toolsExpanded
                            ? Icons.expand_less
                            : Icons.build_outlined,
                        size: 20,
                      ),
                tooltip: tools.isNotEmpty ? (_toolsExpanded ? '收起工具' : '展开工具') : '加载工具',
                onPressed: server.enabled && !loadingTools
                    ? () {
                        if (tools.isNotEmpty) {
                          setState(() => _toolsExpanded = !_toolsExpanded);
                        } else {
                          widget.onLoadTools();
                        }
                      }
                    : null,
              ),
              Switch(
                value: server.enabled,
                onChanged: (_) => widget.onToggle(),
              ),
              IconButton(
                icon: const Icon(Icons.edit_outlined, size: 20),
                tooltip: '编辑',
                onPressed: widget.onEdit,
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline, size: 20),
                tooltip: '删除',
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('确认删除'),
                      content: Text('确定要删除 MCP Server "${server.id}" 吗？'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('取消'),
                        ),
                        FilledButton(
                          onPressed: () {
                            Navigator.pop(ctx);
                            widget.onDelete();
                          },
                          child: const Text('删除'),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
        ),
        // 工具列表 - 可收缩
        if (tools.isNotEmpty) ...[
          InkWell(
            onTap: () => setState(() => _toolsExpanded = !_toolsExpanded),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.3),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '🛠️ 提供的工具 (${tools.length})',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  Icon(
                    _toolsExpanded ? Icons.expand_less : Icons.expand_more,
                    size: 18,
                    color: Theme.of(context).colorScheme.outline,
                  ),
                ],
              ),
            ),
          ),
          if (_toolsExpanded)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Wrap(
                spacing: 8,
                runSpacing: 4,
                children: tools.map((tool) => Chip(
                    label: Text(
                      tool.name,
                      style: const TextStyle(fontSize: 11),
                    ),
                    tooltip: tool.description,
                    visualDensity: VisualDensity.compact,
                  )).toList(),
              ),
            ),
        ],
      ],
    );
  }
}

/// MCP 包安装区域 Widget
class _McpInstallSection extends StatefulWidget {
  final SettingsViewModel vm;
  final StateSetter setBottomState;

  const _McpInstallSection({
    required this.vm,
    required this.setBottomState,
  });

  @override
  State<_McpInstallSection> createState() => _McpInstallSectionState();
}

class _McpInstallSectionState extends State<_McpInstallSection> {
  bool _expanded = false;
  bool _showNpmLog = false;
  final _packageController = TextEditingController();
  final _registryController = TextEditingController();

  @override
  void dispose() {
    _packageController.dispose();
    _registryController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final vm = widget.vm;
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.primaryContainer.withOpacity(0.3),
        border: Border.all(color: colorScheme.primary.withOpacity(0.5)),
        borderRadius: BorderRadius.circular(8),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 标题栏
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '📦 安装 npm 包（可选）',
                style: TextStyle(
                  fontWeight: FontWeight.w500,
                  color: colorScheme.primary,
                ),
              ),
              TextButton(
                onPressed: () {
                  setState(() => _expanded = !_expanded);
                  if (_expanded) {
                    vm.loadInstalledMcpPackages();
                  }
                },
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(_expanded ? '收起' : '展开', style: const TextStyle(fontSize: 12)),
              ),
            ],
          ),
          // 展开内容
          if (_expanded) ...[
            const SizedBox(height: 12),
            // 错误提示
            if (vm.mcpInstallError != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: colorScheme.error),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '❌ 安装失败：',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: colorScheme.error,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      vm.mcpInstallError!,
                      style: TextStyle(fontSize: 12, color: colorScheme.error),
                    ),
                    if (vm.mcpInstallNpmLog != null) ...[
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: () => setState(() => _showNpmLog = !_showNpmLog),
                        child: Text(_showNpmLog ? '隐藏详细日志' : '查看详细 npm 日志'),
                      ),
                      if (_showNpmLog)
                        Container(
                          margin: const EdgeInsets.only(top: 8),
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.grey[900],
                            borderRadius: BorderRadius.circular(4),
                          ),
                          constraints: const BoxConstraints(maxHeight: 200),
                          child: SingleChildScrollView(
                            child: SelectableText(
                              vm.mcpInstallNpmLog!,
                              style: const TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 11,
                                color: Colors.white70,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ],
                ),
              ),
            // 正在探测
            if (vm.probingMcpTools)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: Colors.amber.shade100,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.amber),
                ),
                child: const Row(
                  children: [
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    SizedBox(width: 8),
                    Text('🔍 正在检测 MCP Tools...', style: TextStyle(color: Colors.brown)),
                  ],
                ),
              ),
            // 安装成功提示
            if (vm.probedMcpTools.isNotEmpty && vm.probedMcpPackage != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: Colors.green.shade100,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.green),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '✅ ${vm.probedMcpPackage} 安装成功！',
                      style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '检测到 ${vm.probedMcpTools.length} 个可用 Tools：',
                      style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 12),
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: vm.probedMcpTools.map((tool) => Chip(
                        label: Text(tool.name, style: const TextStyle(fontSize: 10)),
                        tooltip: tool.description,
                        visualDensity: VisualDensity.compact,
                        backgroundColor: Colors.green.shade700,
                        labelStyle: const TextStyle(color: Colors.white),
                      )).toList(),
                    ),
                  ],
                ),
              ),
            // 包名输入
            TextField(
              controller: _packageController,
              decoration: const InputDecoration(
                labelText: '包名',
                hintText: '例如：@anthropic/mcp-server-puppeteer',
                isDense: true,
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            // Registry 输入
            TextField(
              controller: _registryController,
              decoration: const InputDecoration(
                labelText: 'Registry（可选）',
                hintText: '留空使用默认 registry',
                isDense: true,
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            // 安装按钮
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: vm.installingMcpPackage || _packageController.text.trim().isEmpty
                    ? null
                    : () async {
                        widget.setBottomState(() {});
                        final success = await vm.installMcpPackage(
                          _packageController.text.trim(),
                          registry: _registryController.text.trim().isEmpty
                              ? null
                              : _registryController.text.trim(),
                        );
                        widget.setBottomState(() {});
                        if (success) {
                          // 探测 tools
                          await vm.probeMcpPackageTools(_packageController.text.trim());
                          widget.setBottomState(() {});
                        }
                      },
                icon: vm.installingMcpPackage
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.download),
                label: Text(vm.installingMcpPackage ? '安装中...' : '安装包'),
              ),
            ),
            // 已安装的包列表
            if (vm.installedMcpPackages.isNotEmpty) ...[
              const SizedBox(height: 12),
              ExpansionTile(
                title: Text(
                  '已安装的 MCP 包 (${vm.installedMcpPackages.length})',
                  style: const TextStyle(fontSize: 13),
                ),
                tilePadding: EdgeInsets.zero,
                childrenPadding: const EdgeInsets.only(top: 4),
                children: vm.installedMcpPackages.map((pkg) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(pkg.name, style: const TextStyle(fontSize: 12)),
                  subtitle: Text('v${pkg.version}', style: const TextStyle(fontSize: 10)),
                  visualDensity: VisualDensity.compact,
                )).toList(),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
