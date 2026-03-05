import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../models/agent.dart';
import '../../../services/agent_service.dart';

/// Agent 配置页面 — 5 Tab: 基本配置、Prompt、Skills、Tools、知识库
class AgentConfigPage extends StatefulWidget {
  final String agentId;
  const AgentConfigPage({super.key, required this.agentId});

  @override
  State<AgentConfigPage> createState() => _AgentConfigPageState();
}

class _AgentConfigPageState extends State<AgentConfigPage>
    with SingleTickerProviderStateMixin {
  final _svc = AgentService();
  late TabController _tabCtrl;

  Agent? _agent;
  bool _loading = true;

  // 基本配置
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _labelsCtrl = TextEditingController();
  double _temperature = 0.5;
  String _selectedModel = '';
  bool _enabled = true;
  List<ModelProvider> _models = [];
  String _defaultModelId = '';

  // Prompt
  final _promptCtrl = TextEditingController();

  // Skills
  List<Skill> _skills = [];
  bool _loadingSkills = true;

  // Tools
  List<AgentTool> _tools = [];
  bool _loadingTools = true;

  // KB
  List<DocumentSummary> _docs = [];
  bool _loadingDocs = true;

  // MCP Server
  List<McpServerConfig> _mcpServers = [];
  Map<String, List<McpToolSimple>> _mcpServerTools = {};
  Map<String, bool> _loadingMcpTools = {};

  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 6, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _labelsCtrl.dispose();
    _promptCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    try {
      final agents = await _svc.getAgents();
      _agent = agents.firstWhere((a) => a.id == widget.agentId);

      _nameCtrl.text = _agent!.name;
      _descCtrl.text = _agent!.description;
      _labelsCtrl.text = _agent!.labels.join(', ');
      _temperature = _agent!.defaultTemperature ?? 0.5;
      _promptCtrl.text = _agent!.systemPrompt ?? '';
      _enabled = _agent!.enabled;
      _mcpServers = List.from(_agent!.mcpServers);

      // Load model mapping
      try {
        final mappingCfg = await _svc.getConfig('agent_model_mapping');
        final mapping = jsonDecode(mappingCfg['value'] as String);
        _defaultModelId = mapping['defaultModel']?.toString() ?? '';
        final agentCfg = mapping['agents']?[widget.agentId];
        if (agentCfg is Map) {
          final am = agentCfg['model'];
          _selectedModel = am is String ? am : '';
          _enabled = agentCfg['enabled'] != false;
        }
      } catch (_) {}

      try {
        final modelsCfg = await _svc.getConfig('models');
        final list = jsonDecode(modelsCfg['value'] as String);
        if (list is List) {
          _models = list.map((j) => ModelProvider.fromJson(j)).toList();
        }
      } catch (_) {}
    } catch (e) {
      debugPrint('Load agent error: $e');
    }
    setState(() => _loading = false);

    _loadSkills();
    _loadTools();
    _loadDocs();
  }

  Future<void> _loadSkills() async {
    try {
      _skills = await _svc.listSkills(widget.agentId);
    } catch (_) {
      _skills = [];
    }
    setState(() => _loadingSkills = false);
  }

  Future<void> _loadTools() async {
    try {
      _tools = await _svc.listTools(widget.agentId);
    } catch (_) {
      _tools = [];
    }
    setState(() => _loadingTools = false);
  }

  Future<void> _loadDocs() async {
    try {
      _docs = await _svc.listKnowledgeDocs(widget.agentId);
    } catch (_) {
      _docs = [];
    }
    setState(() => _loadingDocs = false);
  }

  void _flash(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _saveBasic() async {
    setState(() => _saving = true);
    try {
      // Save agent config
      final labels = _labelsCtrl.text
          .split(RegExp(r'[,，]'))
          .map((s) => s.trim())
          .where((s) => s.isNotEmpty)
          .toList();
      await _svc.updateAgentConfig(
        widget.agentId,
        name: _nameCtrl.text.trim(),
        description: _descCtrl.text.trim(),
        labels: labels,
        defaultTemperature: _temperature,
        systemPrompt: _promptCtrl.text.trim(),
      );

      // Save model mapping & enabled
      try {
        final mappingCfg = await _svc.getConfig('agent_model_mapping');
        final mapping = jsonDecode(mappingCfg['value'] as String) as Map<String, dynamic>;
        mapping['agents'] ??= {};
        (mapping['agents'] as Map<String, dynamic>)[widget.agentId] ??= {};
        final ac = (mapping['agents'] as Map<String, dynamic>)[widget.agentId] as Map<String, dynamic>;
        ac['enabled'] = _enabled;
        if (_selectedModel.isNotEmpty) {
          ac['model'] = _selectedModel;
        } else {
          ac.remove('model');
        }
        await _svc.updateConfig('agent_model_mapping', jsonEncode(mapping));
      } catch (_) {}

      _flash('已保存');
    } catch (e) {
      _flash('保存失败: $e');
    }
    setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: Text(_agent?.name ?? widget.agentId),
        bottom: TabBar(
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
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabCtrl,
              children: [
                _buildBasicTab(),
                _buildPromptTab(),
                _buildSkillsTab(),
                _buildToolsTab(),
                _buildMcpTab(),
                _buildKbTab(),
              ],
            ),
    );
  }

  // ======================== 基本配置 Tab ========================
  Widget _buildBasicTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _nameCtrl,
            decoration: const InputDecoration(labelText: '名称'),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _descCtrl,
            decoration: const InputDecoration(labelText: '描述'),
            maxLines: 3,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _labelsCtrl,
            decoration: const InputDecoration(
              labelText: '标签',
              hintText: '用逗号分隔',
            ),
          ),
          const SizedBox(height: 16),
          // 模型选择
          DropdownButtonFormField<String>(
            value: _selectedModel.isEmpty ? null : _selectedModel,
            decoration: InputDecoration(
              labelText: '指定模型',
              hintText: _defaultModelId.isNotEmpty
                  ? '使用默认 ($_defaultModelId)'
                  : '使用默认模型',
            ),
            items: [
              const DropdownMenuItem(value: '', child: Text('使用默认')),
              ..._models.map((m) => DropdownMenuItem(
                    value: m.id,
                    child: Text('${m.name} (${m.model})'),
                  )),
            ],
            onChanged: (v) => setState(() => _selectedModel = v ?? ''),
          ),
          const SizedBox(height: 16),
          // Temperature
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
          const SizedBox(height: 16),
          // 启用/禁用
          SwitchListTile(
            title: const Text('启用'),
            value: _enabled,
            onChanged: (v) => setState(() => _enabled = v),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            icon: _saving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.save),
            label: const Text('保存'),
            onPressed: _saving ? null : _saveBasic,
          ),
        ],
      ),
    );
  }

  // ======================== Prompt Tab ========================
  Widget _buildPromptTab() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('System Prompt',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text('定义 Agent 的人设和能力范围。留空将使用自动生成的默认 Prompt。',
              style: TextStyle(
                  color: Theme.of(context).colorScheme.outline, fontSize: 13)),
          const SizedBox(height: 12),
          Expanded(
            child: TextField(
              controller: _promptCtrl,
              maxLines: null,
              expands: true,
              textAlignVertical: TextAlignVertical.top,
              decoration: const InputDecoration(
                hintText: '输入 System Prompt...',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            icon: _saving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.save),
            label: const Text('保存'),
            onPressed: _saving ? null : _saveBasic,
          ),
        ],
      ),
    );
  }

  // ======================== Skills Tab ========================
  Widget _buildSkillsTab() {
    if (_loadingSkills) {
      return const Center(child: CircularProgressIndicator());
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Row(
            children: [
              Text('Skills (${_skills.length})',
                  style: Theme.of(context).textTheme.titleMedium),
              const Spacer(),
              FilledButton.icon(
                icon: const Icon(Icons.add, size: 18),
                label: const Text('添加'),
                onPressed: () => _showSkillEditor(null),
              ),
            ],
          ),
        ),
        Expanded(
          child: _skills.isEmpty
              ? const Center(child: Text('暂无 Skill'))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _skills.length,
                  itemBuilder: (context, i) {
                    final s = _skills[i];
                    return Card(
                      child: ListTile(
                        title: Text(s.name),
                        subtitle: Text(
                          s.description.isNotEmpty
                              ? s.description
                              : s.content.length > 60
                                  ? '${s.content.substring(0, 60)}...'
                                  : s.content,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.edit, size: 20),
                              onPressed: () => _showSkillEditor(s),
                            ),
                            IconButton(
                              icon: Icon(Icons.delete_outline,
                                  size: 20,
                                  color: Theme.of(context).colorScheme.error),
                              onPressed: () => _deleteSkill(s.id),
                            ),
                          ],
                        ),
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
          left: 20,
          right: 20,
          top: 20,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(existing != null ? '编辑 Skill' : '新建 Skill',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 16),
              if (existing == null)
                TextField(
                  controller: idCtrl,
                  decoration: const InputDecoration(labelText: 'Skill ID *'),
                ),
              if (existing == null) const SizedBox(height: 12),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: '名称 *'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: descCtrl,
                decoration: const InputDecoration(labelText: '描述'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: contentCtrl,
                decoration: const InputDecoration(
                  labelText: '内容 *',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
                maxLines: 6,
              ),
              const SizedBox(height: 16),
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
                      if ((existing == null && idCtrl.text.trim().isEmpty) ||
                          nameCtrl.text.trim().isEmpty ||
                          contentCtrl.text.trim().isEmpty) {
                        _flash('ID、名称和内容不能为空');
                        return;
                      }
                      try {
                        if (existing != null) {
                          await _svc.updateSkill(widget.agentId, existing.id,
                              name: nameCtrl.text.trim(),
                              description: descCtrl.text.trim(),
                              content: contentCtrl.text.trim());
                          _flash('Skill 已更新');
                        } else {
                          await _svc.createSkill(widget.agentId,
                              id: idCtrl.text.trim(),
                              name: nameCtrl.text.trim(),
                              description: descCtrl.text.trim(),
                              content: contentCtrl.text.trim());
                          _flash('Skill 已创建');
                        }
                        if (ctx.mounted) Navigator.pop(ctx);
                        _loadSkills();
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

  Future<void> _deleteSkill(String skillId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('确认删除'),
        content: const Text('确定删除此 Skill？'),
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
      try {
        await _svc.deleteSkill(widget.agentId, skillId);
        _flash('已删除');
        _loadSkills();
      } catch (e) {
        _flash('删除失败: $e');
      }
    }
  }

  // ======================== Tools Tab ========================
  Widget _buildToolsTab() {
    if (_loadingTools) {
      return const Center(child: CircularProgressIndicator());
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Row(
            children: [
              Text('Tools (${_tools.length})',
                  style: Theme.of(context).textTheme.titleMedium),
              const Spacer(),
              FilledButton.icon(
                icon: const Icon(Icons.add, size: 18),
                label: const Text('添加'),
                onPressed: () => _showToolEditor(null),
              ),
            ],
          ),
        ),
        Expanded(
          child: _tools.isEmpty
              ? const Center(child: Text('暂无 Tool'))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _tools.length,
                  itemBuilder: (context, i) {
                    final t = _tools[i];
                    return Card(
                      child: ListTile(
                        title: Row(
                          children: [
                            Expanded(child: Text(t.name)),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 1),
                              decoration: BoxDecoration(
                                color: t.enabled
                                    ? Theme.of(context)
                                        .colorScheme
                                        .primaryContainer
                                    : Theme.of(context)
                                        .colorScheme
                                        .surfaceContainerHighest,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                t.handlerType.toUpperCase(),
                                style: const TextStyle(fontSize: 10),
                              ),
                            ),
                          ],
                        ),
                        subtitle: Text(t.description,
                            maxLines: 2, overflow: TextOverflow.ellipsis),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Switch(
                              value: t.enabled,
                              onChanged: (_) => _toggleTool(t),
                            ),
                            IconButton(
                              icon: const Icon(Icons.edit, size: 20),
                              onPressed: () => _showToolEditor(t),
                            ),
                            IconButton(
                              icon: Icon(Icons.delete_outline,
                                  size: 20,
                                  color: Theme.of(context).colorScheme.error),
                              onPressed: () => _deleteTool(t.id),
                            ),
                          ],
                        ),
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
    String handlerType = existing?.handlerType ?? 'http';
    final urlCtrl = TextEditingController(
        text: existing?.handler['url'] as String? ?? '');
    String method = existing?.handler['method'] as String? ?? 'GET';
    final headersCtrl = TextEditingController(
        text: existing?.handler['headers'] is Map
            ? (existing!.handler['headers'] as Map)
                .entries
                .map((e) => '${e.key}: ${e.value}')
                .join('\n')
            : '');
    final bodyCtrl = TextEditingController(
        text: existing?.handler['bodyTemplate'] as String? ?? '');
    final scriptCtrl = TextEditingController(
        text: existing?.handler['scriptFile'] as String? ?? '');
    String runtime = existing?.handler['runtime'] as String? ?? 'node';
    List<ToolParam> params = existing?.parameters
            .map((p) => ToolParam(
                name: p.name,
                type: p.type,
                description: p.description,
                required: p.required))
            .toList() ??
        [];

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
                Text(existing != null ? '编辑 Tool' : '新建 Tool',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 16),
                if (existing == null)
                  TextField(
                    controller: idCtrl,
                    decoration: const InputDecoration(labelText: 'Tool ID *'),
                  ),
                if (existing == null) const SizedBox(height: 12),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: '名称 *'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(labelText: '描述 *'),
                  maxLines: 2,
                ),
                const SizedBox(height: 16),
                // Handler type toggle
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
                              .map((m) => DropdownMenuItem(
                                  value: m, child: Text(m)))
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
                              const InputDecoration(labelText: 'URL *'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: headersCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Headers',
                      hintText: 'Key: Value（每行一个）',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: bodyCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Body Template',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 3,
                  ),
                ] else ...[
                  TextField(
                    controller: scriptCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Script File'),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: runtime,
                    decoration: const InputDecoration(labelText: 'Runtime'),
                    items: ['node', 'python', 'bash']
                        .map((r) =>
                            DropdownMenuItem(value: r, child: Text(r)))
                        .toList(),
                    onChanged: (v) =>
                        setBottomState(() => runtime = v ?? 'node'),
                  ),
                ],
                const SizedBox(height: 16),
                // Parameters
                Row(
                  children: [
                    Text('参数 (${params.length})',
                        style: Theme.of(context).textTheme.titleSmall),
                    const Spacer(),
                    TextButton.icon(
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('添加参数'),
                      onPressed: () {
                        setBottomState(() => params.add(ToolParam(
                            name: '', type: 'string', description: '')));
                      },
                    ),
                  ],
                ),
                ...params.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final p = entry.value;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: TextField(
                            decoration:
                                const InputDecoration(hintText: 'name'),
                            controller:
                                TextEditingController(text: p.name),
                            onChanged: (v) => p.name = v,
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 80,
                          child: DropdownButtonFormField<String>(
                            value: p.type,
                            items: ['string', 'number', 'boolean']
                                .map((t) => DropdownMenuItem(
                                    value: t, child: Text(t)))
                                .toList(),
                            onChanged: (v) =>
                                setBottomState(() => p.type = v ?? 'string'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          flex: 3,
                          child: TextField(
                            decoration:
                                const InputDecoration(hintText: 'description'),
                            controller:
                                TextEditingController(text: p.description),
                            onChanged: (v) => p.description = v,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.remove_circle_outline,
                              size: 20),
                          onPressed: () =>
                              setBottomState(() => params.removeAt(idx)),
                        ),
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 16),
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
                        if ((existing == null &&
                                idCtrl.text.trim().isEmpty) ||
                            nameCtrl.text.trim().isEmpty ||
                            descCtrl.text.trim().isEmpty) {
                          _flash('ID、名称和描述不能为空');
                          return;
                        }

                        Map<String, dynamic> handler;
                        if (handlerType == 'http') {
                          final headers = <String, String>{};
                          for (final line in headersCtrl.text.split('\n')) {
                            final idx = line.indexOf(':');
                            if (idx > 0) {
                              headers[line.substring(0, idx).trim()] =
                                  line.substring(idx + 1).trim();
                            }
                          }
                          handler = {
                            'type': 'http',
                            'url': urlCtrl.text.trim(),
                            'method': method,
                            'headers': headers,
                            'bodyTemplate': bodyCtrl.text.trim(),
                          };
                        } else {
                          handler = {
                            'type': 'script',
                            'scriptFile':
                                scriptCtrl.text.trim(),
                            'runtime': runtime,
                          };
                        }

                        final toolData = {
                          'id': existing?.id ?? idCtrl.text.trim(),
                          'name': nameCtrl.text.trim(),
                          'description': descCtrl.text.trim(),
                          'parameters':
                              params.map((p) => p.toJson()).toList(),
                          'handler': handler,
                          'enabled': existing?.enabled ?? true,
                        };

                        try {
                          if (existing != null) {
                            final fields = Map<String, dynamic>.from(toolData);
                            fields.remove('id');
                            await _svc.updateTool(
                                widget.agentId, existing.id, fields);
                            _flash('Tool 已更新');
                          } else {
                            await _svc.createTool(
                                widget.agentId, toolData);
                            _flash('Tool 已创建');
                          }
                          if (ctx.mounted) Navigator.pop(ctx);
                          _loadTools();
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

  Future<void> _toggleTool(AgentTool tool) async {
    try {
      await _svc.updateTool(
          widget.agentId, tool.id, {'enabled': !tool.enabled});
      _loadTools();
    } catch (e) {
      _flash('操作失败: $e');
    }
  }

  Future<void> _deleteTool(String toolId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('确认删除'),
        content: const Text('确定删除此 Tool？'),
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
      try {
        await _svc.deleteTool(widget.agentId, toolId);
        _flash('已删除');
        _loadTools();
      } catch (e) {
        _flash('删除失败: $e');
      }
    }
  }

  // ======================== 知识库 Tab ========================
  Widget _buildKbTab() {
    if (_loadingDocs) {
      return const Center(child: CircularProgressIndicator());
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Row(
            children: [
              Text('文档 (${_docs.length})',
                  style: Theme.of(context).textTheme.titleMedium),
              const Spacer(),
              TextButton.icon(
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('刷新'),
                onPressed: () {
                  setState(() => _loadingDocs = true);
                  _loadDocs();
                },
              ),
              FilledButton.icon(
                icon: const Icon(Icons.upload, size: 18),
                label: const Text('导入'),
                onPressed: _showImportDialog,
              ),
            ],
          ),
        ),
        if (_docs.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                OutlinedButton.icon(
                  icon: const Icon(Icons.delete_sweep, size: 16),
                  label: const Text('清空知识库'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Theme.of(context).colorScheme.error,
                  ),
                  onPressed: _confirmClearKb,
                ),
              ],
            ),
          ),
        Expanded(
          child: _docs.isEmpty
              ? const Center(child: Text('暂无文档'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _docs.length,
                  itemBuilder: (context, i) {
                    final d = _docs[i];
                    return Card(
                      child: ListTile(
                        leading: const Icon(Icons.description_outlined),
                        title: Text(d.title),
                        subtitle: Text('${d.chunkCount} chunks'),
                        trailing: IconButton(
                          icon: Icon(Icons.delete_outline,
                              color: Theme.of(context).colorScheme.error),
                          onPressed: () => _deleteDoc(d.docId),
                        ),
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
          left: 20,
          right: 20,
          top: 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('导入文档', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            TextField(
              controller: titleCtrl,
              decoration: const InputDecoration(labelText: '文档标题'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: contentCtrl,
              decoration: const InputDecoration(
                labelText: '文档内容',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
              maxLines: 8,
            ),
            const SizedBox(height: 16),
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
                    if (contentCtrl.text.trim().isEmpty) {
                      _flash('内容不能为空');
                      return;
                    }
                    try {
                      await _svc.ingestDocuments(
                        agentId: widget.agentId,
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
                      _flash('导入成功，正在向量化…');
                      if (ctx.mounted) Navigator.pop(ctx);
                      Future.delayed(const Duration(seconds: 3), _loadDocs);
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

  Future<void> _deleteDoc(String docId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('确认删除'),
        content: const Text('确定删除此文档？'),
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
      try {
        await _svc.deleteKnowledgeDoc(widget.agentId, docId);
        _flash('文档已删除');
        _loadDocs();
      } catch (e) {
        _flash('删除失败: $e');
      }
    }
  }

  Future<void> _confirmClearKb() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('确认清空'),
        content: Text('确定清空 ${widget.agentId} 的全部知识库？此操作不可撤销。'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('取消')),
          FilledButton(
              style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.error),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('确认清空')),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await _svc.clearKnowledge(widget.agentId);
        _flash('知识库已清空');
        setState(() {
          _docs = [];
        });
      } catch (e) {
        _flash('清空失败: $e');
      }
    }
  }

  // ======================== MCP Server Tab ========================
  Widget _buildMcpTab() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Row(
            children: [
              Text('MCP Server (${_mcpServers.length})',
                  style: Theme.of(context).textTheme.titleMedium),
              const Spacer(),
              FilledButton.icon(
                icon: const Icon(Icons.add, size: 18),
                label: const Text('添加'),
                onPressed: () => _showMcpServerEditor(null),
              ),
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20),
          child: Text(
            '此处配置的 MCP Server 仅供该 Agent 使用。',
            style: TextStyle(color: Colors.grey, fontSize: 13),
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: _mcpServers.isEmpty
              ? const Center(child: Text('暂无 MCP Server 配置'))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _mcpServers.length,
                  itemBuilder: (context, i) {
                    final server = _mcpServers[i];
                    final isExpanded = _mcpServerTools.containsKey(server.id);
                    final tools = _mcpServerTools[server.id] ?? [];
                    final loading = _loadingMcpTools[server.id] ?? false;

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
                                // 查看工具
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
                                      ? () => _loadMcpServerTools(server)
                                      : null,
                                  tooltip: '查看工具',
                                ),
                                // 启用/禁用
                                Switch(
                                  value: server.enabled,
                                  onChanged: (_) => _toggleMcpServer(server),
                                ),
                                // 编辑
                                IconButton(
                                  icon: const Icon(Icons.edit, size: 20),
                                  onPressed: () => _showMcpServerEditor(server),
                                ),
                                // 删除
                                IconButton(
                                  icon: Icon(Icons.delete_outline,
                                      size: 20,
                                      color: Theme.of(context).colorScheme.error),
                                  onPressed: () => _deleteMcpServer(server.id),
                                ),
                              ],
                            ),
                          ),
                          // 工具列表
                          if (isExpanded && tools.isNotEmpty)
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                              child: Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                children: tools.map((tool) => Chip(
                                  label: Text(tool.name, style: const TextStyle(fontSize: 12)),
                                  backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                                  visualDensity: VisualDensity.compact,
                                )).toList(),
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

  void _showMcpServerEditor(McpServerConfig? existing) {
    final idCtrl = TextEditingController(text: existing?.id ?? '');
    String type = existing?.type ?? 'local';
    bool enabled = existing?.enabled ?? true;
    final commandCtrl = TextEditingController(text: existing?.command ?? '');
    final argsCtrl = TextEditingController(text: existing?.args.join('\n') ?? '');
    final envCtrl = TextEditingController(
        text: existing?.env.entries.map((e) => '${e.key}=${e.value}').join('\n') ?? '');
    final urlCtrl = TextEditingController(text: existing?.url ?? '');
    final headersCtrl = TextEditingController(
        text: existing?.headers.entries.map((e) => '${e.key}: ${e.value}').join('\n') ?? '');

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
                // 启用/禁用
                SwitchListTile(
                  title: const Text('启用'),
                  value: enabled,
                  onChanged: (v) => setBottomState(() => enabled = v),
                  contentPadding: EdgeInsets.zero,
                ),
                const SizedBox(height: 12),
                // 类型选择
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'local', label: Text('📦 本地')),
                    ButtonSegment(value: 'remote', label: Text('🌐 远程')),
                  ],
                  selected: {type},
                  onSelectionChanged: (v) => setBottomState(() => type = v.first),
                ),
                const SizedBox(height: 16),
                if (type == 'local') ...[
                  // npm 包安装区域（仅新增时显示）
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
                                      final pkgs = await _svc.listInstalledMcpPackages();
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
                                      final result = await _svc.installMcpPackage(packageCtrl.text.trim());
                                      if (result.success) {
                                        // 探测 tools
                                        setBottomState(() => probing = true);
                                        try {
                                          final probeResult = await _svc.probeMcpPackageTools(result.packageName);
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
                                          final pkgs = await _svc.listInstalledMcpPackages();
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

                        // 解析 args
                        final args = argsCtrl.text
                            .split('\n')
                            .map((s) => s.trim())
                            .where((s) => s.isNotEmpty)
                            .toList();

                        // 解析 env
                        final env = <String, String>{};
                        for (final line in envCtrl.text.split('\n')) {
                          final idx = line.indexOf('=');
                          if (idx > 0) {
                            env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
                          }
                        }

                        // 解析 headers
                        final headers = <String, String>{};
                        for (final line in headersCtrl.text.split('\n')) {
                          final idx = line.indexOf(':');
                          if (idx > 0) {
                            headers[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
                          }
                        }

                        final newServer = McpServerConfig(
                          id: id,
                          type: type,
                          enabled: enabled,
                          command: type == 'local' ? commandCtrl.text.trim() : null,
                          args: type == 'local' ? args : [],
                          env: type == 'local' ? env : {},
                          url: type == 'remote' ? urlCtrl.text.trim() : null,
                          headers: type == 'remote' ? headers : {},
                        );

                        setState(() {
                          if (existing != null) {
                            final idx = _mcpServers.indexWhere((s) => s.id == existing.id);
                            if (idx >= 0) _mcpServers[idx] = newServer;
                          } else {
                            if (_mcpServers.any((s) => s.id == id)) {
                              _flash('Server ID 已存在');
                              return;
                            }
                            _mcpServers.add(newServer);
                          }
                        });

                        // 保存到后端
                        await _saveMcpServers();
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

  Future<void> _saveMcpServers() async {
    try {
      await _svc.updateAgentConfig(
        widget.agentId,
        mcpServers: _mcpServers.map((s) => s.toJson()).toList(),
      );
    } catch (e) {
      _flash('保存失败: $e');
    }
  }

  void _toggleMcpServer(McpServerConfig server) {
    setState(() {
      final idx = _mcpServers.indexWhere((s) => s.id == server.id);
      if (idx >= 0) {
        _mcpServers[idx] = server.copyWith(enabled: !server.enabled);
      }
    });
    _saveMcpServers();
  }

  Future<void> _deleteMcpServer(String serverId) async {
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
      setState(() {
        _mcpServers.removeWhere((s) => s.id == serverId);
        _mcpServerTools.remove(serverId);
      });
      await _saveMcpServers();
      _flash('MCP Server 已删除');
    }
  }

  Future<void> _loadMcpServerTools(McpServerConfig server) async {
    // 如果已经展开，则收起
    if (_mcpServerTools.containsKey(server.id)) {
      setState(() {
        _mcpServerTools.remove(server.id);
      });
      return;
    }

    setState(() {
      _loadingMcpTools[server.id] = true;
    });

    try {
      final result = await _svc.testMcpServer(server);
      if (result.success) {
        setState(() {
          _mcpServerTools[server.id] = result.tools;
        });
      } else {
        _flash('获取工具失败: ${result.error ?? '未知错误'}');
      }
    } catch (e) {
      _flash('获取工具失败: $e');
    } finally {
      setState(() {
        _loadingMcpTools[server.id] = false;
      });
    }
  }
}
