import { useEffect, useState } from 'react';
import * as api from '../services/api';
import styles from './SettingsPage.module.css';

interface ModelProvider {
  id: string;
  name: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  embeddingModel?: string;
}

const emptyDraft = (): ModelProvider => ({
  id: 'm_' + Date.now().toString(36),
  name: '',
  model: '',
  apiKey: '',
  baseUrl: '',
  embeddingModel: '',
});

export default function SettingsPage() {
  const [models, setModels] = useState<ModelProvider[]>([]);
  const [defaultId, setDefaultId] = useState('');
  // 折叠面板状态
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const toggleSection = (idx: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };
  const [proxyModel, setProxyModel] = useState('');
  const [proxyTab, setProxyTab] = useState<'basic' | 'prompt' | 'skills' | 'tools' | 'kb' | 'mcp'>('basic');
  const [proxyTemperature, setProxyTemperature] = useState(0.7);
  const [proxyClassifyPrompt, setProxyClassifyPrompt] = useState('');
  const [proxyAggregatePrompt, setProxyAggregatePrompt] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ModelProvider>(emptyDraft());
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [testing, setTesting] = useState<string | null>(null); // modelId being tested
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [savedTests, setSavedTests] = useState<Record<string, api.TestModelResult>>({});

  // Proxy Agent KB state
  const [proxyDocs, setProxyDocs] = useState<api.DocumentSummary[]>([]);
  const [proxyLoadingDocs, setProxyLoadingDocs] = useState(false);
  const [proxyKbHasData, setProxyKbHasData] = useState(false);
  const [proxyShowImport, setProxyShowImport] = useState(false);
  const [proxyImportMode, setProxyImportMode] = useState<'file' | 'text'>('file');
  const [proxyImportFiles, setProxyImportFiles] = useState<File[]>([]);
  const [proxyImportTitle, setProxyImportTitle] = useState('');
  const [proxyImportText, setProxyImportText] = useState('');
  const [proxyImporting, setProxyImporting] = useState(false);

  // Proxy Agent Skills state
  const [proxySkills, setProxySkills] = useState<api.SkillInfo[]>([]);
  const [proxyLoadingSkills, setProxyLoadingSkills] = useState(false);
  const [proxyShowSkillForm, setProxyShowSkillForm] = useState(false);
  const [proxyEditingSkill, setProxyEditingSkill] = useState<api.SkillInfo | null>(null);
  const [proxySkillDraft, setProxySkillDraft] = useState({ id: '', name: '', description: '', content: '' });
  const [proxySavingSkill, setProxySavingSkill] = useState(false);

  // Proxy Agent Tools state
  const [proxyTools, setProxyTools] = useState<api.AgentToolConfig[]>([]);
  const [proxyLoadingTools, setProxyLoadingTools] = useState(false);
  const [proxyShowToolForm, setProxyShowToolForm] = useState(false);
  const [proxyEditingTool, setProxyEditingTool] = useState<api.AgentToolConfig | null>(null);
  const [proxyToolDraft, setProxyToolDraft] = useState<api.AgentToolConfig>({
    id: '', name: '', description: '', parameters: [],
    handler: { type: 'http', url: '', method: 'GET', headers: {}, bodyTemplate: '' },
    enabled: true,
  });
  const [proxySavingTool, setProxySavingTool] = useState(false);
  const [proxyHeadersText, setProxyHeadersText] = useState('');
  const [proxyScriptFile, setProxyScriptFile] = useState<File | null>(null);

  // Proxy Agent MCP Server state
  const [proxyMcpServers, setProxyMcpServers] = useState<api.McpServerConfig[]>([]);
  const [proxyMcpShowForm, setProxyMcpShowForm] = useState(false);
  const [proxyMcpEditingServer, setProxyMcpEditingServer] = useState<api.McpServerConfig | null>(null);
  const [proxyMcpDraft, setProxyMcpDraft] = useState<api.McpServerConfig>({
    id: '', type: 'local', command: '', args: [], env: {}, enabled: true,
  });
  const [proxyMcpEnvText, setProxyMcpEnvText] = useState('');
  const [proxyMcpHeadersText, setProxyMcpHeadersText] = useState('');
  const [proxyMcpTestResult, setProxyMcpTestResult] = useState<{ success: boolean; tools?: api.McpTool[]; error?: string } | null>(null);
  const [proxyMcpTesting, setProxyMcpTesting] = useState(false);
  const [proxyMcpToolsExpanded, setProxyMcpToolsExpanded] = useState<Record<string, boolean>>({});
  const [proxyMcpServerTools, setProxyMcpServerTools] = useState<Record<string, api.McpTool[]>>({});
  const [proxyMcpLoadingTools, setProxyMcpLoadingTools] = useState<Record<string, boolean>>({});

  // Global Tools state
  const [globalTools, setGlobalTools] = useState<api.AgentToolConfig[]>([]);
  const [globalLoadingTools, setGlobalLoadingTools] = useState(false);
  const [globalShowToolForm, setGlobalShowToolForm] = useState(false);
  const [globalEditingTool, setGlobalEditingTool] = useState<api.AgentToolConfig | null>(null);
  const [globalToolDraft, setGlobalToolDraft] = useState<api.AgentToolConfig>({
    id: '', name: '', description: '', parameters: [],
    handler: { type: 'http', url: '', method: 'GET', headers: {}, bodyTemplate: '' },
    enabled: true,
  });
  const [globalSavingTool, setGlobalSavingTool] = useState(false);
  const [globalHeadersText, setGlobalHeadersText] = useState('');
  const [globalScriptFile, setGlobalScriptFile] = useState<File | null>(null);

  // MCP Server state
  const [mcpServers, setMcpServers] = useState<api.McpServerConfig[]>([]);
  const [mcpLoadingServers, setMcpLoadingServers] = useState(false);
  const [mcpShowForm, setMcpShowForm] = useState(false);
  const [mcpEditingServer, setMcpEditingServer] = useState<api.McpServerConfig | null>(null);
  const [mcpDraft, setMcpDraft] = useState<api.McpServerConfig>({
    id: '', type: 'local', command: '', args: [], env: {}, enabled: true,
  });
  const [mcpSavingServer, setMcpSavingServer] = useState(false);
  const [mcpArgsText, setMcpArgsText] = useState('');
  const [mcpEnvText, setMcpEnvText] = useState('');
  const [mcpHeadersText, setMcpHeadersText] = useState('');
  const [mcpServerTools, setMcpServerTools] = useState<Record<string, api.McpTool[]>>({});
  const [mcpLoadingTools, setMcpLoadingTools] = useState<Record<string, boolean>>({});
  const [mcpToolsExpanded, setMcpToolsExpanded] = useState<Record<string, boolean>>({});
  // MCP Package Install
  const [mcpShowInstall, setMcpShowInstall] = useState(false);
  const [mcpInstallPackage, setMcpInstallPackage] = useState('');
  const [mcpInstallRegistry, setMcpInstallRegistry] = useState('');
  const [mcpInstalling, setMcpInstalling] = useState(false);
  const [mcpInstalledPackages, setMcpInstalledPackages] = useState<api.InstalledMcpPackage[]>([]);
  const [mcpInstallError, setMcpInstallError] = useState<string | null>(null);
  const [mcpInstallNpmLog, setMcpInstallNpmLog] = useState<string | null>(null);
  const [mcpShowNpmLog, setMcpShowNpmLog] = useState(false);
  // MCP Tools 探测
  const [mcpProbing, setMcpProbing] = useState(false);
  const [mcpProbedTools, setMcpProbedTools] = useState<api.McpToolInfo[]>([]);
  const [mcpProbedPackage, setMcpProbedPackage] = useState<string | null>(null);
  const [mcpProbeError, setMcpProbeError] = useState<string | null>(null);
  // MCP Server 测试
  const [mcpTesting, setMcpTesting] = useState(false);
  const [mcpTestResult, setMcpTestResult] = useState<api.McpTestResult | null>(null);

  useEffect(() => {
    loadData();
    loadProxyDocs();
    loadProxySkills();
    loadProxyTools();
    loadGlobalTools();
    loadMcpServers();
  }, []);

  const loadData = async () => {
    try {
      const [modelsCfg, mappingCfg, testResults] = await Promise.all([
        api.getConfig('models').catch(() => null),
        api.getConfig('agent_model_mapping').catch(() => null),
        api.getModelTestResults().catch(() => ({})),
      ]);
      setSavedTests(testResults as Record<string, api.TestModelResult>);
      if (modelsCfg) {
        const parsed = JSON.parse(modelsCfg.value);
        setModels(Array.isArray(parsed) ? parsed : []);
      }
      if (mappingCfg) {
        const mapping = JSON.parse(mappingCfg.value);
        setDefaultId(mapping.defaultModel || '');
        const proxyCfg = mapping.agents?.['proxy-agent'] || {};
        setProxyModel(proxyCfg.model || '');
        setProxyTemperature(proxyCfg.temperature != null ? Number(proxyCfg.temperature) : 0.7);
        setProxyClassifyPrompt(proxyCfg.classifyPrompt || '');
        setProxyAggregatePrompt(proxyCfg.aggregatePrompt || '');
        setProxyMcpServers(proxyCfg.mcpServers || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const persistModels = async (list: ModelProvider[]) => {
    await api.updateConfig('models', JSON.stringify(list));
    setModels(list);
  };

  const updateDefault = async (id: string) => {
    const mappingCfg = await api.getConfig('agent_model_mapping').catch(() => null);
    const mapping = mappingCfg ? JSON.parse(mappingCfg.value) : {};
    mapping.defaultModel = id;
    await api.updateConfig('agent_model_mapping', JSON.stringify(mapping));
    setDefaultId(id);
  };

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const mask = (key: string) => {
    if (!key) return '未设置';
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 3) + '••••' + key.slice(-4);
  };

  const toggleKey = (id: string) =>
    setShowKeys((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  /* ——— CRUD handlers ——— */

  const handleAdd = () => {
    const d = emptyDraft();
    setDraft(d);
    setEditingId(d.id);
  };

  const handleEdit = (m: ModelProvider) => {
    setDraft({ ...m });
    setEditingId(m.id);
  };

  const handleCancel = () => setEditingId(null);

  const handleSave = async () => {
    if (!draft.name.trim() || !draft.model.trim()) {
      flash('❌ 名称和模型不能为空');
      return;
    }
    setSaving(true);
    try {
      const exists = models.find((m) => m.id === draft.id);
      const newModels = exists
        ? models.map((m) => (m.id === draft.id ? { ...draft } : m))
        : [...models, { ...draft }];
      await persistModels(newModels);

      // 第一个模型或当前默认已不存在 → 自动设为默认
      if (!defaultId || !newModels.find((m) => m.id === defaultId)) {
        await updateDefault(draft.id);
      }
      setEditingId(null);
      flash('✅ 已保存');
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const newModels = models.filter((m) => m.id !== id);
      await persistModels(newModels);
      if (defaultId === id) {
        await updateDefault(newModels[0]?.id || '');
      }
      if (editingId === id) setEditingId(null);
      flash('已删除');
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSetDefault = async (id: string) => {
    await updateDefault(id);
    flash('✅ 已设为默认');
  };

  /** 将 API 返回结果转为显示文本 */
  const formatTestMsg = (r: api.TestModelResult): { ok: boolean; msg: string } => {
    if (r.success) {
      return { ok: true, msg: `✅ 连通成功 (${r.latency}ms)${r.reply ? ` — "${r.reply}"` : ''}` };
    }
    return { ok: false, msg: `❌ 连接失败: ${r.message}` };
  };

  /** 测试模型连通性 */
  const handleTest = async (m: ModelProvider) => {
    setTesting(m.id);
    setTestResult(null);
    try {
      const r = await api.testModel({ modelId: m.id, model: m.model, apiKey: m.apiKey, baseUrl: m.baseUrl });
      const fmt = formatTestMsg(r);
      setTestResult({ id: m.id, ...fmt });
      setSavedTests((prev) => ({ ...prev, [m.id]: r }));
    } catch (err) {
      setTestResult({ id: m.id, ok: false, msg: `❌ ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setTesting(null);
    }
  };

  /** 测试当前编辑表单中的配置（未保存也可测试） */
  const handleTestDraft = async () => {
    if (!draft.model || !draft.apiKey) {
      flash('❌ 需要填写模型和 API Key 才能测试');
      return;
    }
    setTesting(draft.id);
    setTestResult(null);
    try {
      const r = await api.testModel({ modelId: draft.id, model: draft.model, apiKey: draft.apiKey, baseUrl: draft.baseUrl });
      const fmt = formatTestMsg(r);
      setTestResult({ id: draft.id, ...fmt });
      setSavedTests((prev) => ({ ...prev, [draft.id]: r }));
    } catch (err) {
      setTestResult({ id: draft.id, ok: false, msg: `❌ ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setTesting(null);
    }
  };

  /* ——— Proxy KB handlers ——— */
  const loadProxyDocs = async () => {
    setProxyLoadingDocs(true);
    try {
      const [docs, status] = await Promise.all([
        api.listKnowledgeDocs('proxy-agent').catch(() => []),
        api.getKnowledgeStatus('proxy-agent').catch(() => null),
      ]);
      setProxyDocs(docs);
      setProxyKbHasData(status?.hasData ?? docs.length > 0);
    } catch { /* ignore */ }
    finally { setProxyLoadingDocs(false); }
  };

  const handleProxyDeleteDoc = async (docId: string) => {
    try {
      await api.deleteKnowledgeDoc('proxy-agent', docId);
      flash('已删除');
      loadProxyDocs();
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  };


  const handleProxyImport = async () => {
    setProxyImporting(true);
    try {
      const documents: Array<{ id: string; title: string; content: string }> = [];
      if (proxyImportMode === 'file') {
        for (const f of proxyImportFiles) {
          const text = await f.text();
          documents.push({ id: `file_${Date.now()}_${f.name}`, title: f.name, content: text });
        }
      } else {
        if (!proxyImportText.trim()) return;
        documents.push({
          id: `text_${Date.now()}`,
          title: proxyImportTitle.trim() || '未命名文档',
          content: proxyImportText,
        });
      }
      await api.ingestDocuments('proxy-agent', documents);
      flash('✅ 导入成功');
      setProxyShowImport(false);
      setProxyImportFiles([]);
      setProxyImportTitle('');
      setProxyImportText('');
      loadProxyDocs();
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProxyImporting(false);
    }
  };

  const handleProxyModelChange = async (id: string) => {
    try {
      const mappingCfg = await api.getConfig('agent_model_mapping').catch(() => null);
      const mapping = mappingCfg ? JSON.parse(mappingCfg.value) : {};
      if (!mapping.agents) mapping.agents = {};
      if (!mapping.agents['proxy-agent']) mapping.agents['proxy-agent'] = {};
      if (id) {
        mapping.agents['proxy-agent'].model = id;
      } else {
        delete mapping.agents['proxy-agent'].model;
      }
      await api.updateConfig('agent_model_mapping', JSON.stringify(mapping));
      setProxyModel(id);
      flash('✅ 已保存');
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleProxyConfigSave = async () => {
    try {
      const mappingCfg = await api.getConfig('agent_model_mapping').catch(() => null);
      const mapping = mappingCfg ? JSON.parse(mappingCfg.value) : {};
      if (!mapping.agents) mapping.agents = {};
      if (!mapping.agents['proxy-agent']) mapping.agents['proxy-agent'] = {};
      mapping.agents['proxy-agent'].temperature = proxyTemperature;
      mapping.agents['proxy-agent'].classifyPrompt = proxyClassifyPrompt.trim() || undefined;
      mapping.agents['proxy-agent'].aggregatePrompt = proxyAggregatePrompt.trim() || undefined;
      mapping.agents['proxy-agent'].mcpServers = proxyMcpServers.length > 0 ? proxyMcpServers : undefined;
      await api.updateConfig('agent_model_mapping', JSON.stringify(mapping));
      flash('✅ 已保存');
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /* ——— Proxy Skills handlers ——— */
  const loadProxySkills = async () => {
    setProxyLoadingSkills(true);
    try {
      const list = await api.listSkills('proxy-agent');
      setProxySkills(list);
    } catch { setProxySkills([]); }
    finally { setProxyLoadingSkills(false); }
  };

  const openProxySkillCreate = () => {
    setProxyEditingSkill(null);
    setProxySkillDraft({ id: '', name: '', description: '', content: '' });
    setProxyShowSkillForm(true);
  };

  const openProxySkillEdit = (skill: api.SkillInfo) => {
    setProxyEditingSkill(skill);
    setProxySkillDraft({ id: skill.id, name: skill.name, description: skill.description, content: skill.content });
    setProxyShowSkillForm(true);
  };

  const handleProxySaveSkill = async () => {
    if (!proxySkillDraft.id.trim() || !proxySkillDraft.name.trim() || !proxySkillDraft.content.trim()) {
      flash('❌ Skill ID、名称和内容不能为空');
      return;
    }
    setProxySavingSkill(true);
    try {
      if (proxyEditingSkill) {
        await api.updateSkill('proxy-agent', proxyEditingSkill.id, {
          name: proxySkillDraft.name.trim(),
          description: proxySkillDraft.description.trim(),
          content: proxySkillDraft.content.trim(),
        });
        flash('✅ Skill 已更新');
      } else {
        await api.createSkill('proxy-agent', {
          id: proxySkillDraft.id.trim(),
          name: proxySkillDraft.name.trim(),
          description: proxySkillDraft.description.trim(),
          content: proxySkillDraft.content.trim(),
        });
        flash('✅ Skill 已创建');
      }
      setProxyShowSkillForm(false);
      loadProxySkills();
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally { setProxySavingSkill(false); }
  };

  const handleProxyDeleteSkill = async (skillId: string) => {
    if (!confirm('确认删除此 Skill？')) return;
    try {
      await api.deleteSkill('proxy-agent', skillId);
      setProxySkills((prev) => prev.filter((s) => s.id !== skillId));
      flash('✅ 已删除');
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /* ——— Proxy Tools handlers ——— */
  const loadProxyTools = async () => {
    setProxyLoadingTools(true);
    try {
      const list = await api.listTools('proxy-agent');
      setProxyTools(list);
    } catch { setProxyTools([]); }
    finally { setProxyLoadingTools(false); }
  };

  const headersToText = (h: Record<string, string> | undefined): string =>
    h ? Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\n') : '';

  const textToHeaders = (t: string): Record<string, string> => {
    const headers: Record<string, string> = {};
    for (const line of t.split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return headers;
  };

  const openProxyToolCreate = () => {
    setProxyEditingTool(null);
    setProxyToolDraft({
      id: '', name: '', description: '', parameters: [],
      handler: { type: 'http', url: '', method: 'GET', headers: {}, bodyTemplate: '' },
      enabled: true,
    });
    setProxyHeadersText('');
    setProxyScriptFile(null);
    setProxyShowToolForm(true);
  };

  const openProxyToolEdit = (tool: api.AgentToolConfig) => {
    setProxyEditingTool(tool);
    setProxyToolDraft({ ...tool });
    setProxyHeadersText(tool.handler.type === 'http' ? headersToText(tool.handler.headers) : '');
    setProxyScriptFile(null);
    setProxyShowToolForm(true);
  };

  const handleProxySaveTool = async () => {
    if (!proxyToolDraft.id.trim() || !proxyToolDraft.name.trim() || !proxyToolDraft.description.trim()) {
      flash('❌ Tool ID、名称和描述不能为空');
      return;
    }
    const hType = proxyToolDraft.handler.type;
    if (hType === 'http' && !(proxyToolDraft.handler as api.HttpHandler).url.trim()) {
      flash('❌ Handler URL 不能为空');
      return;
    }
    if (hType === 'script' && !proxyEditingTool && !proxyScriptFile) {
      flash('❌ 请选择要上传的脚本文件');
      return;
    }
    setProxySavingTool(true);
    try {
      let payload: any;
      if (hType === 'http') {
        payload = { ...proxyToolDraft, handler: { ...proxyToolDraft.handler, headers: textToHeaders(proxyHeadersText) } };
      } else {
        payload = { ...proxyToolDraft };
      }

      let savedToolId = proxyToolDraft.id.trim();
      if (proxyEditingTool) {
        const { id: _, ...fields } = payload;
        await api.updateTool('proxy-agent', proxyEditingTool.id, fields);
        savedToolId = proxyEditingTool.id;
        flash('✅ Tool 已更新');
      } else {
        await api.createTool('proxy-agent', payload);
        flash('✅ Tool 已创建');
      }

      if (hType === 'script' && proxyScriptFile) {
        await api.uploadToolScript('proxy-agent', savedToolId, proxyScriptFile);
        flash(proxyEditingTool ? '✅ Tool 已更新（脚本已上传）' : '✅ Tool 已创建（脚本已上传）');
      }

      setProxyShowToolForm(false);
      loadProxyTools();
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally { setProxySavingTool(false); }
  };

  const handleProxyDeleteTool = async (toolId: string) => {
    if (!confirm('确认删除此 Tool？')) return;
    try {
      await api.deleteTool('proxy-agent', toolId);
      setProxyTools((prev) => prev.filter((t) => t.id !== toolId));
      flash('✅ 已删除');
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleProxyToggleTool = async (tool: api.AgentToolConfig) => {
    try {
      await api.updateTool('proxy-agent', tool.id, { enabled: !tool.enabled });
      loadProxyTools();
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const addProxyToolParam = () => {
    setProxyToolDraft({
      ...proxyToolDraft,
      parameters: [...proxyToolDraft.parameters, { name: '', type: 'string', description: '', required: true }],
    });
  };

  const updateProxyToolParam = (idx: number, field: string, value: string | boolean) => {
    const params = [...proxyToolDraft.parameters];
    (params[idx] as any)[field] = value;
    setProxyToolDraft({ ...proxyToolDraft, parameters: params });
  };

  const removeProxyToolParam = (idx: number) => {
    setProxyToolDraft({ ...proxyToolDraft, parameters: proxyToolDraft.parameters.filter((_, i) => i !== idx) });
  };

  /* ——— Global Tools handlers ——— */
  const loadGlobalTools = async () => {
    setGlobalLoadingTools(true);
    try {
      const list = await api.listGlobalTools();
      setGlobalTools(list);
    } catch { setGlobalTools([]); }
    finally { setGlobalLoadingTools(false); }
  };

  const openGlobalToolCreate = () => {
    setGlobalEditingTool(null);
    setGlobalToolDraft({
      id: '', name: '', description: '', parameters: [],
      handler: { type: 'http', url: '', method: 'GET', headers: {}, bodyTemplate: '' },
      enabled: true,
    });
    setGlobalHeadersText('');
    setGlobalScriptFile(null);
    setGlobalShowToolForm(true);
  };

  const openGlobalToolEdit = (tool: api.AgentToolConfig) => {
    setGlobalEditingTool(tool);
    setGlobalToolDraft({ ...tool });
    setGlobalHeadersText(tool.handler.type === 'http' ? headersToText(tool.handler.headers) : '');
    setGlobalScriptFile(null);
    setGlobalShowToolForm(true);
  };

  const handleGlobalSaveTool = async () => {
    if (!globalToolDraft.id.trim() || !globalToolDraft.name.trim() || !globalToolDraft.description.trim()) {
      flash('❌ Tool ID、名称和描述不能为空');
      return;
    }
    const hType = globalToolDraft.handler.type;
    if (hType === 'http' && !(globalToolDraft.handler as api.HttpHandler).url.trim()) {
      flash('❌ Handler URL 不能为空');
      return;
    }
    if (hType === 'script' && !globalEditingTool && !globalScriptFile) {
      flash('❌ 请选择要上传的脚本文件');
      return;
    }
    setGlobalSavingTool(true);
    try {
      let payload: any;
      if (hType === 'http') {
        payload = { ...globalToolDraft, handler: { ...globalToolDraft.handler, headers: textToHeaders(globalHeadersText) } };
      } else {
        payload = { ...globalToolDraft };
      }

      let savedToolId = globalToolDraft.id.trim();
      if (globalEditingTool) {
        const { id: _, ...fields } = payload;
        await api.updateGlobalTool(globalEditingTool.id, fields);
        savedToolId = globalEditingTool.id;
        flash('✅ 全局Tool已更新');
      } else {
        await api.createGlobalTool(payload);
        flash('✅ 全局Tool已创建');
      }

      if (hType === 'script' && globalScriptFile) {
        await api.uploadGlobalToolScript(savedToolId, globalScriptFile);
        flash(globalEditingTool ? '✅ 工具已更新（脚本已上传）' : '✅ 工具已创建（脚本已上传）');
      }

      setGlobalShowToolForm(false);
      loadGlobalTools();
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally { setGlobalSavingTool(false); }
  };

  const handleGlobalDeleteTool = async (toolId: string) => {
    if (!confirm('确认删除此全局Tool？')) return;
    try {
      await api.deleteGlobalTool(toolId);
      setGlobalTools((prev) => prev.filter((t) => t.id !== toolId));
      flash('✅ 已删除');
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleGlobalToggleTool = async (tool: api.AgentToolConfig) => {
    try {
      await api.updateGlobalTool(tool.id, { enabled: !tool.enabled });
      loadGlobalTools();
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const addGlobalToolParam = () => {
    setGlobalToolDraft({
      ...globalToolDraft,
      parameters: [...globalToolDraft.parameters, { name: '', type: 'string', description: '', required: true }],
    });
  };

  const updateGlobalToolParam = (idx: number, field: string, value: string | boolean) => {
    const params = [...globalToolDraft.parameters];
    (params[idx] as any)[field] = value;
    setGlobalToolDraft({ ...globalToolDraft, parameters: params });
  };

  const removeGlobalToolParam = (idx: number) => {
    setGlobalToolDraft({ ...globalToolDraft, parameters: globalToolDraft.parameters.filter((_, i) => i !== idx) });
  };

  // ============================================================
  // MCP Server 管理
  // ============================================================

  const loadMcpServers = async () => {
    setMcpLoadingServers(true);
    try {
      const list = await api.listMcpServers();
      setMcpServers(list);
    } catch { setMcpServers([]); }
    setMcpLoadingServers(false);
  };

  const openMcpServerCreate = () => {
    setMcpEditingServer(null);
    setMcpDraft({ id: '', type: 'local', command: '', args: [], env: {}, url: '', headers: {}, enabled: true });
    setMcpArgsText('');
    setMcpEnvText('');
    setMcpHeadersText('');
    // 重置安装相关状态
    setMcpShowInstall(false);
    setMcpInstallPackage('');
    setMcpInstallError(null);
    setMcpInstallNpmLog(null);
    setMcpShowNpmLog(false);
    setMcpProbedTools([]);
    setMcpProbedPackage(null);
    setMcpProbeError(null);
    setMcpShowForm(true);
  };

  const openMcpServerEdit = (server: api.McpServerConfig) => {
    setMcpEditingServer(server);
    setMcpDraft({ ...server });
    setMcpArgsText((server.args || []).join('\n'));
    setMcpEnvText(Object.entries(server.env || {}).map(([k, v]) => `${k}=${v}`).join('\n'));
    setMcpHeadersText(Object.entries(server.headers || {}).map(([k, v]) => `${k}=${v}`).join('\n'));
    setMcpShowForm(true);
  };

  const handleMcpSaveServer = async () => {
    const serverType = mcpDraft.type || 'local';
    if (!mcpDraft.id) {
      flash('❌ ID 为必填');
      return;
    }
    if (serverType === 'local' && !mcpDraft.command) {
      flash('❌ 本地 MCP Server 需要填写启动命令');
      return;
    }
    if (serverType === 'remote' && !mcpDraft.url) {
      flash('❌ 远程 MCP Server 需要填写 URL');
      return;
    }

    setMcpSavingServer(true);
    try {
      // 解析 args 和 env
      const args = mcpArgsText.split('\n').map(s => s.trim()).filter(Boolean);
      const env: Record<string, string> = {};
      mcpEnvText.split('\n').forEach(line => {
        const idx = line.indexOf('=');
        if (idx > 0) {
          env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      });
      const headers: Record<string, string> = {};
      mcpHeadersText.split('\n').forEach(line => {
        const idx = line.indexOf('=');
        if (idx > 0) {
          headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      });

      const serverToSave: api.McpServerConfig = {
        ...mcpDraft,
        args,
        env,
        headers,
      };

      if (mcpEditingServer) {
        await api.updateMcpServer(mcpDraft.id, serverToSave);
        flash('✅ MCP Server 已更新');
      } else {
        await api.createMcpServer(serverToSave);
        flash('✅ MCP Server 已创建');
      }

      setMcpShowForm(false);
      loadMcpServers();
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally { setMcpSavingServer(false); }
  };

  const handleMcpDeleteServer = async (serverId: string) => {
    if (!confirm('确认删除此 MCP Server？')) return;
    try {
      await api.deleteMcpServer(serverId);
      setMcpServers((prev) => prev.filter((s) => s.id !== serverId));
      flash('✅ 已删除');
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleMcpToggleServer = async (server: api.McpServerConfig) => {
    try {
      await api.updateMcpServer(server.id, { enabled: !server.enabled });
      loadMcpServers();
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const loadMcpServerToolsList = async (serverId: string) => {
    // 如果已经有工具列表，切换展开/收起状态
    if (mcpServerTools[serverId] && mcpServerTools[serverId].length > 0) {
      setMcpToolsExpanded(prev => ({ ...prev, [serverId]: !prev[serverId] }));
      return;
    }
    setMcpLoadingTools(prev => ({ ...prev, [serverId]: true }));
    try {
      const tools = await api.getMcpServerTools(serverId);
      setMcpServerTools(prev => ({ ...prev, [serverId]: tools }));
      // 加载完成后自动展开
      setMcpToolsExpanded(prev => ({ ...prev, [serverId]: true }));
    } catch (err) {
      flash(`❌ 获取工具列表失败: ${err instanceof Error ? err.message : String(err)}`);
    }
    setMcpLoadingTools(prev => ({ ...prev, [serverId]: false }));
  };

  const loadInstalledPackages = async () => {
    try {
      const packages = await api.listInstalledMcpPackages();
      setMcpInstalledPackages(packages);
    } catch { setMcpInstalledPackages([]); }
  };

  const handleMcpInstallPackage = async () => {
    if (!mcpInstallPackage.trim()) {
      flash('❌ 请输入包名');
      return;
    }
    setMcpInstalling(true);
    setMcpInstallError(null);
    setMcpInstallNpmLog(null);
    setMcpShowNpmLog(false);
    setMcpProbedTools([]);
    setMcpProbedPackage(null);
    setMcpProbeError(null);
    try {
      const result = await api.installMcpPackage(
        mcpInstallPackage.trim(),
        mcpInstallRegistry.trim() || undefined
      );
      if (result.success) {
        flash(`✅ ${result.packageName} 安装成功，正在检测可用 Tools...`);
        setMcpInstallError(null);
        setMcpInstallNpmLog(null);
        loadInstalledPackages();
        // 安装成功后自动探测 tools
        setMcpProbing(true);
        try {
          const probeResult = await api.probeMcpPackageTools(result.packageName);
          if (probeResult.success && probeResult.tools.length > 0) {
            setMcpProbedTools(probeResult.tools);
            setMcpProbedPackage(result.packageName);
            // 自动填充 MCP Server 配置表单
            if (probeResult.mcpConfig) {
              setMcpDraft((prev) => ({
                ...prev,
                id: prev.id || probeResult.mcpConfig!.id,
                type: 'local',
                command: probeResult.mcpConfig!.command,
                args: probeResult.mcpConfig!.args,
                enabled: true,
              }));
              setMcpArgsText(probeResult.mcpConfig.args.join('\n'));
            }
            flash(`🔧 检测到 ${probeResult.tools.length} 个可用 Tools，已自动填充配置`);
          } else if (probeResult.error) {
            setMcpProbeError(probeResult.error);
            flash(`⚠️ Tools 探测失败: ${probeResult.error}`);
          } else {
            setMcpProbeError('未检测到可用 Tools（可能需要配置启动参数）');
          }
        } catch (probeErr) {
          const msg = probeErr instanceof Error ? probeErr.message : String(probeErr);
          setMcpProbeError(msg);
        } finally {
          setMcpProbing(false);
        }
        setMcpInstallPackage('');
      } else {
        const errorMsg = result.stderr || result.message || '未知错误';
        setMcpInstallError(errorMsg);
        setMcpInstallNpmLog(result.npmLog || null);
        flash(`❌ 安装失败`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMcpInstallError(errorMsg);
      setMcpInstallNpmLog(null);
      flash(`❌ 安装失败`);
    } finally {
      setMcpInstalling(false);
    }
  };

  /* ——— Render helpers ——— */

  const renderCard = (m: ModelProvider) => {
    const isDefault = m.id === defaultId;
    return (
      <>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <span className={styles.modelName}>{m.name}</span>
            {isDefault && <span className={styles.defaultBadge}>默认</span>}
          </div>
          <div className={styles.cardActions}>
            <button
              className={styles.actionBtn}
              onClick={() => handleTest(m)}
              title="测试连通性"
              disabled={testing === m.id}
            >
              {testing === m.id ? '⏳' : '🔬'}
            </button>
            {!isDefault && (
              <button className={styles.actionBtn} onClick={() => handleSetDefault(m.id)} title="设为默认">⭐</button>
            )}
            <button className={styles.actionBtn} onClick={() => handleEdit(m)} title="编辑">✏️</button>
            <button className={`${styles.actionBtn} ${styles.deleteAction}`} onClick={() => handleDelete(m.id)} title="删除">🗑</button>
          </div>
        </div>
        <div className={styles.cardBody}>
          {/* 实时测试结果（刚点击测试） */}
          {testResult && testResult.id === m.id && (
            <div className={`${styles.testResult} ${testResult.ok ? styles.testOk : styles.testFail}`}>
              {testResult.msg}
            </div>
          )}
          {/* DB 持久化的历史测试结果（页面加载时显示） */}
          {!(testResult && testResult.id === m.id) && savedTests[m.id] && (
            <div className={`${styles.testResult} ${savedTests[m.id].success ? styles.testOk : styles.testFail}`}>
              {savedTests[m.id].success
                ? `✅ 上次测试通过 (${savedTests[m.id].latency}ms)`
                : `❌ 上次测试失败: ${savedTests[m.id].message}`}
              {savedTests[m.id].testedAt && (
                <span className={styles.testTime}>
                  {' · '}{new Date(savedTests[m.id].testedAt!).toLocaleString('zh-CN')}
                </span>
              )}
            </div>
          )}
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>模型</span>
            <span className={styles.metaValue}>{m.model}</span>
          </div>
          {m.baseUrl && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>URL</span>
              <span className={styles.metaValue}>{m.baseUrl}</span>
            </div>
          )}
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Key</span>
            <span className={styles.metaValue}>
              {showKeys.has(m.id) ? m.apiKey : mask(m.apiKey)}
              {m.apiKey && (
                <button className={styles.eyeBtn} onClick={() => toggleKey(m.id)} type="button">
                  {showKeys.has(m.id) ? '🙈' : '👁'}
                </button>
              )}
            </span>
          </div>
        </div>
      </>
    );
  };

  const renderEditForm = () => (
    <div className={styles.editForm}>
      <label className={styles.field}>
        <span>名称</span>
        <input
          className={styles.input}
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="如: GPT-4.1 Mini"
        />
      </label>
      <label className={styles.field}>
        <span>模型</span>
        <input
          className={styles.input}
          value={draft.model}
          onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
          placeholder="例如 gpt-4o-mini"
        />
      </label>
      <label className={styles.field}>
        <span>API URL</span>
        <input
          className={styles.input}
          value={draft.baseUrl}
          onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
          placeholder="https://api.openai.com/v1（留空使用默认）"
        />
      </label>
      <label className={styles.field}>
        <span>API Key</span>
        <input
          className={styles.input}
          value={draft.apiKey}
          onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
          placeholder="sk-..."
          autoComplete="off"
        />
      </label>
      <label className={styles.field}>
        <span>Embedding 模型</span>
        <input
          className={styles.input}
          value={draft.embeddingModel || ''}
          onChange={(e) => setDraft((d) => ({ ...d, embeddingModel: e.target.value }))}
          placeholder="留空自动检测（DashScope → text-embedding-v3，OpenAI → text-embedding-ada-002）"
        />
      </label>
      <div className={styles.formActions}>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? '保存中…' : '保存'}
        </button>
        <button
          className={styles.testBtn}
          onClick={handleTestDraft}
          disabled={testing === draft.id || !draft.model || !draft.apiKey}
        >
          {testing === draft.id ? '测试中…' : '🔬 测试'}
        </button>
        <button className={styles.cancelBtn} onClick={handleCancel}>取消</button>
      </div>
      {testResult && testResult.id === draft.id && (
        <div className={`${styles.testResult} ${testResult.ok ? styles.testOk : styles.testFail}`}>
          {testResult.msg}
        </div>
      )}
    </div>
  );

  /* ——— Main render ——— */

  return (
    <div className={styles.page}>
    <div className={styles.pageInner}>
      <h1>设置</h1>
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* ==================== 模型管理 ==================== */}
      <div className={styles.collapsiblePanel}>
        <div className={styles.panelHeader} onClick={() => toggleSection(0)}>
          <span className={styles.panelIcon}>🤖</span>
          <div className={styles.panelTitleArea}>
            <h3 className={styles.panelTitle}>模型管理</h3>
            <p className={styles.panelSubtitle}>{models.length} 个模型已配置</p>
          </div>
          <span className={`${styles.panelToggle} ${expandedSections.has(0) ? styles.expanded : ''}`}>▼</span>
        </div>
        <div className={expandedSections.has(0) ? styles.panelBody : styles.panelBodyHidden}>
          <p className={styles.hint} style={{ marginTop: 0 }}>
            添加兼容 OpenAI API 的模型配置。配置好的模型可在 Agent 中选择使用。
          </p>
          <div style={{ marginBottom: '12px' }}>
            <button className={styles.addBtn} onClick={handleAdd} disabled={editingId !== null}>
              + 添加模型
            </button>
          </div>

          <div className={styles.modelList}>
            {/* 新增表单（尚不在列表中） */}
            {editingId && !models.find((m) => m.id === editingId) && (
              <div className={styles.modelCard}>{renderEditForm()}</div>
            )}

            {models.map((m) => (
              <div
                key={m.id}
                className={`${styles.modelCard} ${m.id === defaultId ? styles.isDefault : ''}`}
              >
                {editingId === m.id ? renderEditForm() : renderCard(m)}
              </div>
            ))}

            {models.length === 0 && !editingId && (
              <p className={styles.emptyText}>暂未配置模型。点击「添加模型」开始。</p>
            )}
          </div>
        </div>
      </div>

      {/* ==================== Proxy Agent ==================== */}
      <div className={styles.collapsiblePanel}>
        <div className={styles.panelHeader} onClick={() => toggleSection(1)}>
          <span className={styles.panelIcon}>🔀</span>
          <div className={styles.panelTitleArea}>
            <h3 className={styles.panelTitle}>Proxy Agent</h3>
            <p className={styles.panelSubtitle}>意图识别 / 任务路由配置</p>
          </div>
          <span className={`${styles.panelToggle} ${expandedSections.has(1) ? styles.expanded : ''}`}>▼</span>
        </div>
        <div className={expandedSections.has(1) ? styles.panelBody : styles.panelBodyHidden}>
        <p className={styles.hint} style={{ marginTop: 0 }}>
          Proxy Agent 负责意图识别与任务路由，可单独指定使用的模型、提示词、技能、工具和知识库。
        </p>

        <div className={styles.proxyTabBar}>
          {[
            { id: 'basic' as const, label: '基本配置' },
            { id: 'prompt' as const, label: 'Prompt' },
            { id: 'skills' as const, label: 'Skills' },
            { id: 'tools' as const, label: 'Tools' },
            { id: 'mcp' as const, label: 'MCP Server' },
            { id: 'kb' as const, label: '知识库' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`${styles.proxyTabItem} ${proxyTab === tab.id ? styles.proxyTabActive : ''}`}
              onClick={() => setProxyTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.proxyTabPanel}>

        {/* ===== Tab: 基本配置 ===== */}
        {proxyTab === 'basic' && (
          <>
        <label className={styles.field}>
          <span>模型</span>
          <select
            className={styles.select}
            value={proxyModel}
            onChange={(e) => handleProxyModelChange(e.target.value)}
          >
            <option value="">
              使用默认{defaultId ? ` (${models.find((m) => m.id === defaultId)?.name || defaultId})` : ''}
            </option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.model})
              </option>
            ))}
          </select>
          {models.length === 0 && (
            <span className={styles.fieldHint}>请先在上方添加模型配置</span>
          )}
        </label>

        <label className={styles.field}>
          <span>Temperature</span>
          <div className={styles.tempRow}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              className={styles.tempSlider}
              value={proxyTemperature}
              onChange={(e) => setProxyTemperature(Number(e.target.value))}
            />
            <span className={styles.tempValue}>{proxyTemperature}</span>
          </div>
        </label>
        <div className={styles.proxyConfigActions}>
          <button className={styles.saveBtn} onClick={handleProxyConfigSave}>
            保存配置
          </button>
        </div>
          </>
        )}

        {/* ===== Tab: Prompt ===== */}
        {proxyTab === 'prompt' && (
          <>
        <label className={styles.field}>
          <span>代理路由 System Prompt</span>
          <textarea
            rows={8}
            className={styles.kbTextarea}
            placeholder="留空则使用内置默认。用于意图识别与 Agent 路由，支持 {agentList} 占位符。"
            value={proxyClassifyPrompt}
            onChange={(e) => setProxyClassifyPrompt(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>内容聚合 System Prompt</span>
          <textarea
            rows={8}
            className={styles.kbTextarea}
            placeholder="留空则使用内置默认。用于汇总多个领域 Agent 的输出结果。"
            value={proxyAggregatePrompt}
            onChange={(e) => setProxyAggregatePrompt(e.target.value)}
          />
        </label>
        <div className={styles.proxyConfigActions}>
          <button className={styles.saveBtn} onClick={handleProxyConfigSave}>
            保存配置
          </button>
        </div>
          </>
        )}

        {/* ===== Tab: Skills ===== */}
        {proxyTab === 'skills' && (
          <>
        <p className={styles.hint}>管理 Proxy Agent 的 Skill（提示词模板），可在意图识别和结果聚合时使用。</p>
        <div className={styles.kbActions}>
          <button className={styles.kbImportBtn} onClick={openProxySkillCreate}>➕ 添加 Skill</button>
          <button className={styles.kbRefreshBtn} onClick={loadProxySkills}>🔄</button>
        </div>

        {proxyShowSkillForm && (
          <div className={styles.kbImportForm}>
            {!proxyEditingSkill && (
              <label className={styles.field}>
                <span>Skill ID</span>
                <input
                  value={proxySkillDraft.id}
                  onChange={(e) => setProxySkillDraft({ ...proxySkillDraft, id: e.target.value })}
                  placeholder="小写字母+连字符，如 summarize"
                  className={styles.input}
                />
              </label>
            )}
            <label className={styles.field}>
              <span>名称</span>
              <input
                value={proxySkillDraft.name}
                onChange={(e) => setProxySkillDraft({ ...proxySkillDraft, name: e.target.value })}
                placeholder="Skill 名称"
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span>描述</span>
              <input
                value={proxySkillDraft.description}
                onChange={(e) => setProxySkillDraft({ ...proxySkillDraft, description: e.target.value })}
                placeholder="简要描述此 Skill 的用途"
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span>内容</span>
              <textarea
                value={proxySkillDraft.content}
                onChange={(e) => setProxySkillDraft({ ...proxySkillDraft, content: e.target.value })}
                placeholder="Skill 内容（Markdown 格式的提示词模板）…"
                rows={6}
                className={styles.kbTextarea}
              />
            </label>
            <div className={styles.kbImportActions}>
              <button className={styles.saveBtn} onClick={handleProxySaveSkill} disabled={proxySavingSkill}>
                {proxySavingSkill ? '保存中…' : proxyEditingSkill ? '更新' : '创建'}
              </button>
              <button className={styles.cancelBtn} onClick={() => setProxyShowSkillForm(false)}>取消</button>
            </div>
          </div>
        )}

        {proxyLoadingSkills ? (
          <p className={styles.hint}>加载 Skills 中…</p>
        ) : proxySkills.length === 0 ? (
          <p className={styles.hint}>暂无 Skill。点击「添加 Skill」创建。</p>
        ) : (
          <div className={styles.kbDocList}>
            {proxySkills.map((skill) => (
              <div key={skill.id} className={styles.skillItem}>
                <div className={styles.kbDocInfo}>
                  <span className={styles.kbDocTitle}>{skill.name}</span>
                  <span className={styles.kbDocChunks}>{skill.description || skill.id}</span>
                </div>
                <div className={styles.skillActions}>
                  <button className={styles.skillEditBtn} onClick={() => openProxySkillEdit(skill)} title="编辑">✏️</button>
                  <button className={styles.kbDocDelete} onClick={() => handleProxyDeleteSkill(skill.id)} title="删除">×</button>
                </div>
              </div>
            ))}
          </div>
        )}
          </>
        )}

        {/* ===== Tab: Tools ===== */}
        {proxyTab === 'tools' && (
          <>
        <p className={styles.hint}>配置 Proxy Agent 可调用的外部工具（HTTP API 或脚本），在通用对话和结果聚合时可被 LLM 调用。</p>
        <div className={styles.kbActions}>
          <button className={styles.kbImportBtn} onClick={openProxyToolCreate}>➕ 添加 Tool</button>
          <button className={styles.kbRefreshBtn} onClick={loadProxyTools}>🔄</button>
        </div>

        {proxyShowToolForm && (
          <div className={styles.kbImportForm}>
            {!proxyEditingTool && (
              <label className={styles.field}>
                <span>Tool ID</span>
                <input
                  value={proxyToolDraft.id}
                  onChange={(e) => setProxyToolDraft({ ...proxyToolDraft, id: e.target.value })}
                  placeholder="小写字母+连字符，如 search-web"
                  className={styles.input}
                />
              </label>
            )}
            <label className={styles.field}>
              <span>名称（Tool Name）</span>
              <input
                value={proxyToolDraft.name}
                onChange={(e) => setProxyToolDraft({ ...proxyToolDraft, name: e.target.value })}
                placeholder="LLM 调用用的名称，如 search_web"
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span>描述</span>
              <input
                value={proxyToolDraft.description}
                onChange={(e) => setProxyToolDraft({ ...proxyToolDraft, description: e.target.value })}
                placeholder="工具功能描述（展示给 LLM）"
                className={styles.input}
              />
            </label>

            {/* 参数定义 */}
            <div className={styles.toolParamsSection}>
              <div className={styles.toolParamsHeader}>
                <span className={styles.toolParamsLabel}>参数</span>
                <button className={styles.toolParamAddBtn} onClick={addProxyToolParam} type="button">+ 添加</button>
              </div>
              {proxyToolDraft.parameters.map((p, i) => (
                <div key={i} className={styles.toolParamRow}>
                  <input value={p.name} onChange={(e) => updateProxyToolParam(i, 'name', e.target.value)} placeholder="参数名" className={styles.toolParamInput} />
                  <select value={p.type} onChange={(e) => updateProxyToolParam(i, 'type', e.target.value)} className={styles.toolParamType}>
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                  </select>
                  <input value={p.description} onChange={(e) => updateProxyToolParam(i, 'description', e.target.value)} placeholder="参数描述" className={styles.toolParamDesc} />
                  <label className={styles.toolParamReq} title="必填">
                    <input type="checkbox" checked={p.required !== false} onChange={(e) => updateProxyToolParam(i, 'required', e.target.checked)} />
                    必填
                  </label>
                  <button className={styles.toolParamRemove} onClick={() => removeProxyToolParam(i)} title="删除">×</button>
                </div>
              ))}
            </div>

            {/* Handler 类型选择 */}
            <div className={styles.toolHandlerSection}>
              <div className={styles.toolHandlerRow}>
                <span className={styles.toolParamsLabel}>Handler 类型</span>
                <select
                  value={proxyToolDraft.handler.type}
                  onChange={(e) => {
                    const newType = e.target.value as 'http' | 'script';
                    if (newType === 'http') {
                      setProxyToolDraft({ ...proxyToolDraft, handler: { type: 'http', url: '', method: 'GET', headers: {}, bodyTemplate: '' } });
                      setProxyHeadersText('');
                    } else {
                      setProxyToolDraft({ ...proxyToolDraft, handler: { type: 'script', scriptFile: '', runtime: 'node' } });
                    }
                    setProxyScriptFile(null);
                  }}
                  className={styles.toolParamType}
                >
                  <option value="http">HTTP 请求</option>
                  <option value="script">脚本执行</option>
                </select>
              </div>

              {/* HTTP Handler */}
              {proxyToolDraft.handler.type === 'http' && (() => {
                const h = proxyToolDraft.handler as api.HttpHandler;
                return (
                  <>
                    <div className={styles.toolHandlerRow}>
                      <select value={h.method || 'GET'} onChange={(e) => setProxyToolDraft({ ...proxyToolDraft, handler: { ...h, method: e.target.value } })} className={styles.toolParamType}>
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                        <option value="PATCH">PATCH</option>
                      </select>
                      <input value={h.url} onChange={(e) => setProxyToolDraft({ ...proxyToolDraft, handler: { ...h, url: e.target.value } })} placeholder="https://api.example.com/{{query}}" className={styles.toolHandlerUrl} />
                    </div>
                    <label className={styles.field}>
                      <span>Headers（每行 key: value）</span>
                      <textarea value={proxyHeadersText} onChange={(e) => setProxyHeadersText(e.target.value)} placeholder="Authorization: Bearer xxx" rows={3} className={styles.kbTextarea} />
                    </label>
                    {['POST', 'PUT', 'PATCH'].includes(h.method || '') && (
                      <label className={styles.field}>
                        <span>Body Template</span>
                        <textarea value={h.bodyTemplate || ''} onChange={(e) => setProxyToolDraft({ ...proxyToolDraft, handler: { ...h, bodyTemplate: e.target.value } })} placeholder='{"query": "{{query}}"}' rows={3} className={styles.kbTextarea} />
                      </label>
                    )}
                  </>
                );
              })()}

              {/* Script Handler */}
              {proxyToolDraft.handler.type === 'script' && (() => {
                const h = proxyToolDraft.handler as api.ScriptHandler;
                return (
                  <>
                    <div className={styles.toolHandlerRow}>
                      <span className={styles.toolParamsLabel}>运行时</span>
                      <select value={h.runtime || 'node'} onChange={(e) => setProxyToolDraft({ ...proxyToolDraft, handler: { ...h, runtime: e.target.value as 'node' | 'python' | 'bash' } })} className={styles.toolParamType}>
                        <option value="node">Node.js</option>
                        <option value="python">Python</option>
                        <option value="bash">Bash</option>
                      </select>
                    </div>
                    <label className={styles.field}>
                      <span>超时（毫秒，默认 30000）</span>
                      <input type="number" value={h.timeout || 30000} onChange={(e) => setProxyToolDraft({ ...proxyToolDraft, handler: { ...h, timeout: Number(e.target.value) || 30000 } })} className={styles.input} />
                    </label>
                    <label className={styles.field}>
                      <span>脚本文件</span>
                      <input type="file" accept=".js,.ts,.py,.sh,.bash,.mjs,.cjs" onChange={(e) => setProxyScriptFile(e.target.files?.[0] || null)} className={styles.input} />
                    </label>
                    {h.scriptFile && <p className={styles.hint}>当前脚本: {h.scriptFile}</p>}
                    <p className={styles.hint}>脚本通过 stdin 接收 JSON 参数，通过 stdout 返回结果。也可通过环境变量 TOOL_PARAMS 读取。</p>
                  </>
                );
              })()}
            </div>

            <div className={styles.kbImportActions}>
              <button className={styles.saveBtn} onClick={handleProxySaveTool} disabled={proxySavingTool}>
                {proxySavingTool ? '保存中…' : proxyEditingTool ? '更新' : '创建'}
              </button>
              <button className={styles.cancelBtn} onClick={() => setProxyShowToolForm(false)}>取消</button>
            </div>
          </div>
        )}

        {proxyLoadingTools ? (
          <p className={styles.hint}>加载 Tools 中…</p>
        ) : proxyTools.length === 0 ? (
          <p className={styles.hint}>暂无 Tool。点击「添加 Tool」配置新的外部工具。</p>
        ) : (
          <div className={styles.kbDocList}>
            {proxyTools.map((tool) => (
              <div key={tool.id} className={styles.skillItem}>
                <div className={styles.kbDocInfo}>
                  <span className={styles.kbDocTitle}>{tool.name}</span>
                  <span className={styles.kbDocChunks}>
                    {tool.handler.type === 'http'
                      ? `${(tool.handler as api.HttpHandler).method || 'GET'} ${(tool.handler as api.HttpHandler).url.slice(0, 30)}`
                      : `📜 ${(tool.handler as api.ScriptHandler).runtime} · ${(tool.handler as api.ScriptHandler).scriptFile || '未上传'}`
                    }
                  </span>
                </div>
                <div className={styles.skillActions}>
                  <button
                    className={`${styles.toolToggleBtn} ${tool.enabled !== false ? styles.toolEnabled : ''}`}
                    onClick={() => handleProxyToggleTool(tool)}
                    title={tool.enabled !== false ? '已启用' : '已禁用'}
                  >
                    {tool.enabled !== false ? '✅' : '⚪'}
                  </button>
                  <button className={styles.skillEditBtn} onClick={() => openProxyToolEdit(tool)} title="编辑">✏️</button>
                  <button className={styles.kbDocDelete} onClick={() => handleProxyDeleteTool(tool.id)} title="删除">×</button>
                </div>
              </div>
            ))}
          </div>
        )}
          </>
        )}

        {/* ===== Tab: 知识库 ===== */}
        {proxyTab === 'kb' && (
          <>
        <div className={styles.kbActions}>
          <button className={styles.kbImportBtn} onClick={() => setProxyShowImport(true)}>📥 导入文档</button>
          <button className={styles.kbRefreshBtn} onClick={loadProxyDocs}>🔄</button>
        </div>

        {proxyShowImport && (
          <div className={styles.kbImportForm}>
            <div className={styles.kbModeTabs}>
              <button
                className={`${styles.kbModeTab} ${proxyImportMode === 'file' ? styles.kbModeActive : ''}`}
                onClick={() => setProxyImportMode('file')}
              >
                📁 文件导入
              </button>
              <button
                className={`${styles.kbModeTab} ${proxyImportMode === 'text' ? styles.kbModeActive : ''}`}
                onClick={() => setProxyImportMode('text')}
              >
                ✏️ 文本粘贴
              </button>
            </div>

            {proxyImportMode === 'file' ? (
              <>
                <label className={styles.kbFileLabel}>
                  <span className={styles.kbFileDrop}>
                    {proxyImportFiles.length > 0
                      ? proxyImportFiles.map((f) => f.name).join(', ')
                      : '点击选择文件（支持 .txt .md .json .csv 等文本文件）'}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".txt,.md,.json,.csv,.log,.xml,.yaml,.yml,.html,.htm,.js,.ts,.py,.java,.c,.cpp,.go,.rs,.toml,.ini,.cfg,.conf,.sh,.bat"
                    className={styles.kbFileInput}
                    onChange={(e) => setProxyImportFiles(Array.from(e.target.files || []))}
                  />
                </label>
                {proxyImportFiles.length > 0 && (
                  <p className={styles.hint}>
                    已选择 {proxyImportFiles.length} 个文件，共 {(proxyImportFiles.reduce((s, f) => s + f.size, 0) / 1024).toFixed(1)} KB
                  </p>
                )}
              </>
            ) : (
              <>
                <label className={styles.field}>
                  <span>标题</span>
                  <input
                    value={proxyImportTitle}
                    onChange={(e) => setProxyImportTitle(e.target.value)}
                    placeholder="文档标题"
                    className={styles.input}
                  />
                </label>
                <label className={styles.field}>
                  <span>内容</span>
                  <textarea
                    value={proxyImportText}
                    onChange={(e) => setProxyImportText(e.target.value)}
                    placeholder="粘贴文档内容…"
                    rows={6}
                    className={styles.kbTextarea}
                  />
                </label>
              </>
            )}

            <div className={styles.kbImportActions}>
              <button
                className={styles.saveBtn}
                onClick={handleProxyImport}
                disabled={proxyImporting || (proxyImportMode === 'text' ? !proxyImportText.trim() : proxyImportFiles.length === 0)}
              >
                {proxyImporting ? '导入中…' : '导入'}
              </button>
              <button className={styles.cancelBtn} onClick={() => { setProxyShowImport(false); setProxyImportFiles([]); }}>取消</button>
            </div>
          </div>
        )}

        {proxyLoadingDocs ? (
          <p className={styles.hint}>加载文档中…</p>
        ) : proxyDocs.length === 0 ? (
          <p className={styles.hint}>暂无文档。点击「导入文档」添加知识。</p>
        ) : (
          <div className={styles.kbDocList}>
            {proxyDocs.map((doc) => (
              <div key={doc.docId} className={styles.kbDocItem}>
                <div className={styles.kbDocInfo}>
                  <span className={styles.kbDocTitle}>{doc.title}</span>
                  <span className={styles.kbDocChunks}>{doc.chunkCount} 片段</span>
                </div>
                <button
                  className={styles.kbDocDelete}
                  onClick={() => handleProxyDeleteDoc(doc.docId)}
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
          </>
        )}

        {/* ===== Tab: MCP Server ===== */}
        {proxyTab === 'mcp' && (
          <>
          <div className={styles.kbActions}>
            <button className={styles.kbImportBtn} onClick={() => {
              setProxyMcpEditingServer(null);
              setProxyMcpDraft({ id: '', type: 'local', enabled: true, command: '', args: [], env: {}, url: '', headers: {} });
              setProxyMcpEnvText('');
              setProxyMcpHeadersText('');
              setProxyMcpTestResult(null);
              setProxyMcpShowForm(true);
            }}>
              ➕ 添加 MCP Server
            </button>
          </div>

          {proxyMcpShowForm && (
            <div className={styles.kbImportForm}>
              <div className={styles.kbModeTabs}>
                <button
                  className={`${styles.kbModeTab} ${proxyMcpDraft.type === 'local' ? styles.kbModeActive : ''}`}
                  onClick={() => setProxyMcpDraft({ ...proxyMcpDraft, type: 'local' })}
                >
                  📦 本地
                </button>
                <button
                  className={`${styles.kbModeTab} ${proxyMcpDraft.type === 'remote' ? styles.kbModeActive : ''}`}
                  onClick={() => setProxyMcpDraft({ ...proxyMcpDraft, type: 'remote' })}
                >
                  🌐 远程
                </button>
              </div>

              <label className={styles.field}>
                <span>Server ID *</span>
                <input
                  value={proxyMcpDraft.id}
                  onChange={(e) => setProxyMcpDraft({ ...proxyMcpDraft, id: e.target.value })}
                  placeholder="唯一标识，如 my-mcp-server"
                  className={styles.select}
                  disabled={!!proxyMcpEditingServer}
                />
              </label>

              <label className={styles.switchRow} style={{ marginBottom: '12px' }}>
                <span>启用</span>
                <input
                  type="checkbox"
                  checked={proxyMcpDraft.enabled !== false}
                  onChange={(e) => setProxyMcpDraft({ ...proxyMcpDraft, enabled: e.target.checked })}
                />
                <span className={`${styles.toggle} ${proxyMcpDraft.enabled !== false ? styles.on : ''}`} />
              </label>

              {proxyMcpDraft.type === 'local' ? (
                <>
                  {/* 安装 MCP 包区域 - 仅新增时显示 */}
                  {!proxyMcpEditingServer && (
                    <div style={{
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #0ea5e9',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '16px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mcpShowInstall ? '12px' : 0 }}>
                        <span style={{ fontWeight: 500, color: '#0369a1' }}>📦 安装 npm 包（可选）</span>
                        <button
                          onClick={() => { setMcpShowInstall(!mcpShowInstall); if (!mcpShowInstall) loadInstalledPackages(); }}
                          style={{
                            background: mcpShowInstall ? '#e0f2fe' : '#0ea5e9',
                            color: mcpShowInstall ? '#0369a1' : 'white',
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          {mcpShowInstall ? '收起' : '展开'}
                        </button>
                      </div>
                      {mcpShowInstall && (
                        <>
                          {mcpInstallError && (
                            <div style={{
                              backgroundColor: '#fee2e2',
                              border: '1px solid #ef4444',
                              borderRadius: '6px',
                              padding: '12px',
                              marginBottom: '12px',
                              color: '#dc2626',
                              fontSize: '13px',
                            }}>
                              <strong>❌ 安装失败：</strong>
                              <pre style={{ margin: '8px 0 0', fontSize: '12px', whiteSpace: 'pre-wrap', maxHeight: '150px', overflow: 'auto' }}>{mcpInstallError}</pre>
                            </div>
                          )}
                          {mcpProbing && (
                            <div style={{ padding: '8px', color: '#0ea5e9', fontSize: '13px' }}>
                              ⏳ 正在探测 Tools...
                            </div>
                          )}
                          {mcpProbedTools.length > 0 && mcpProbedPackage && (
                            <div style={{
                              marginBottom: '12px',
                              padding: '8px',
                              border: '1px solid #10b981',
                              borderRadius: '6px',
                              backgroundColor: '#ecfdf5',
                            }}>
                              <strong style={{ color: '#059669', fontSize: '13px' }}>
                                🔧 {mcpProbedPackage} 提供 {mcpProbedTools.length} 个 Tools:
                              </strong>
                              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {mcpProbedTools.map((t) => (
                                  <span key={t.name} style={{ background: '#d1fae5', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                                    {t.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {mcpProbeError && !mcpProbing && (
                            <div style={{
                              marginBottom: '12px',
                              padding: '8px',
                              border: '1px solid #f59e0b',
                              borderRadius: '6px',
                              backgroundColor: '#fffbeb',
                              color: '#b45309',
                              fontSize: '12px',
                            }}>
                              ⚠️ {mcpProbeError}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                            <input
                              type="text"
                              value={mcpInstallPackage}
                              onChange={(e) => setMcpInstallPackage(e.target.value)}
                              placeholder="包名，如 @modelcontextprotocol/server-filesystem"
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                border: '1px solid #94a3b8',
                                borderRadius: '6px',
                                fontSize: '13px',
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleMcpInstallPackage(); }}
                            />
                            <button
                              onClick={handleMcpInstallPackage}
                              disabled={mcpInstalling || !mcpInstallPackage.trim()}
                              style={{
                                background: mcpInstalling ? '#94a3b8' : '#0ea5e9',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                cursor: mcpInstalling ? 'not-allowed' : 'pointer',
                                fontSize: '13px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {mcpInstalling ? '安装中...' : '安装'}
                            </button>
                          </div>
                          <div style={{ marginBottom: '8px' }}>
                            <input
                              type="text"
                              value={mcpInstallRegistry}
                              onChange={(e) => setMcpInstallRegistry(e.target.value)}
                              placeholder="npm registry（可选，如 https://registry.npmmirror.com）"
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #94a3b8',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#64748b',
                              }}
                            />
                          </div>
                          <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 8px' }}>
                            常用: @modelcontextprotocol/server-filesystem, server-github, server-puppeteer
                          </p>
                          {mcpInstalledPackages.length > 0 && (
                            <details style={{ fontSize: '12px', color: '#475569' }}>
                              <summary style={{ cursor: 'pointer' }}>已安装的 MCP 包 ({mcpInstalledPackages.length})</summary>
                              <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
                                {mcpInstalledPackages.map(pkg => (
                                  <li key={pkg.name}>{pkg.name} <span style={{ color: '#888' }}>({pkg.version})</span></li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  <label className={styles.field}>
                    <span>启动命令 *</span>
                    <input
                      value={proxyMcpDraft.command || ''}
                      onChange={(e) => setProxyMcpDraft({ ...proxyMcpDraft, command: e.target.value })}
                      placeholder="如: npx, node, python"
                      className={styles.select}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>命令参数（每行一个）</span>
                    <textarea
                      value={(proxyMcpDraft.args || []).join('\n')}
                      onChange={(e) => setProxyMcpDraft({ ...proxyMcpDraft, args: e.target.value.split('\n').filter(Boolean) })}
                      placeholder={"-y\n@anthropic/mcp-server-xxx"}
                      rows={3}
                      className={styles.kbTextarea}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>环境变量（KEY=VALUE 每行一个）</span>
                    <textarea
                      value={proxyMcpEnvText}
                      onChange={(e) => setProxyMcpEnvText(e.target.value)}
                      placeholder={"API_KEY=xxx\nDEBUG=true"}
                      rows={2}
                      className={styles.kbTextarea}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className={styles.field}>
                    <span>远程 URL *</span>
                    <input
                      value={proxyMcpDraft.url || ''}
                      onChange={(e) => setProxyMcpDraft({ ...proxyMcpDraft, url: e.target.value })}
                      placeholder="https://example.com/mcp"
                      className={styles.select}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>请求头（KEY: VALUE 每行一个）</span>
                    <textarea
                      value={proxyMcpHeadersText}
                      onChange={(e) => setProxyMcpHeadersText(e.target.value)}
                      placeholder={"Authorization: Bearer xxx"}
                      rows={2}
                      className={styles.kbTextarea}
                    />
                  </label>
                </>
              )}

              {/* 测试结果 */}
              {proxyMcpTestResult && (
                <div style={{
                  padding: '8px 12px',
                  marginBottom: '12px',
                  borderRadius: '6px',
                  backgroundColor: proxyMcpTestResult.success ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${proxyMcpTestResult.success ? '#10b981' : '#ef4444'}`,
                }}>
                  {proxyMcpTestResult.success ? (
                    <span style={{ color: '#059669' }}>
                      ✅ 连接成功，发现 {proxyMcpTestResult.tools?.length || 0} 个工具
                    </span>
                  ) : (
                    <span style={{ color: '#dc2626' }}>
                      ❌ 连接失败: {proxyMcpTestResult.error}
                    </span>
                  )}
                </div>
              )}

              <div className={styles.kbImportActions}>
                <button
                  className={styles.saveBtn}
                  style={{ backgroundColor: '#6366f1' }}
                  onClick={async () => {
                    setProxyMcpTesting(true);
                    setProxyMcpTestResult(null);
                    try {
                      // 解析 env / headers
                      const env: Record<string, string> = {};
                      proxyMcpEnvText.split('\n').filter(Boolean).forEach(line => {
                        const idx = line.indexOf('=');
                        if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
                      });
                      const headers: Record<string, string> = {};
                      proxyMcpHeadersText.split('\n').filter(Boolean).forEach(line => {
                        const idx = line.indexOf(':');
                        if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
                      });
                      const testConfig: api.McpServerConfig = {
                        ...proxyMcpDraft,
                        env: proxyMcpDraft.type === 'local' ? env : undefined,
                        headers: proxyMcpDraft.type === 'remote' ? headers : undefined,
                      };
                      const result = await api.testMcpServer(testConfig);
                      setProxyMcpTestResult({ success: result.success, tools: result.tools, error: result.error });
                    } catch (err) {
                      setProxyMcpTestResult({ success: false, error: err instanceof Error ? err.message : String(err) });
                    } finally {
                      setProxyMcpTesting(false);
                    }
                  }}
                  disabled={proxyMcpTesting || !proxyMcpDraft.id || (proxyMcpDraft.type === 'local' ? !proxyMcpDraft.command : !proxyMcpDraft.url)}
                >
                  {proxyMcpTesting ? '测试中…' : '🔍 测试连接'}
                </button>
                <button
                  className={styles.saveBtn}
                  onClick={() => {
                    // 解析 env / headers
                    const env: Record<string, string> = {};
                    proxyMcpEnvText.split('\n').filter(Boolean).forEach(line => {
                      const idx = line.indexOf('=');
                      if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
                    });
                    const headers: Record<string, string> = {};
                    proxyMcpHeadersText.split('\n').filter(Boolean).forEach(line => {
                      const idx = line.indexOf(':');
                      if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
                    });
                    const newServer: api.McpServerConfig = {
                      ...proxyMcpDraft,
                      env: proxyMcpDraft.type === 'local' ? env : undefined,
                      headers: proxyMcpDraft.type === 'remote' ? headers : undefined,
                    };
                    if (proxyMcpEditingServer) {
                      setProxyMcpServers(proxyMcpServers.map(s => s.id === proxyMcpEditingServer.id ? newServer : s));
                    } else {
                      if (proxyMcpServers.some(s => s.id === newServer.id)) {
                        flash('Server ID 已存在');
                        return;
                      }
                      setProxyMcpServers([...proxyMcpServers, newServer]);
                    }
                    setProxyMcpShowForm(false);
                    // 自动保存配置
                    handleProxyConfigSave();
                  }}
                  disabled={!proxyMcpDraft.id || (proxyMcpDraft.type === 'local' ? !proxyMcpDraft.command : !proxyMcpDraft.url)}
                >
                  {proxyMcpEditingServer ? '更新' : '添加'}
                </button>
                <button className={styles.cancelBtn} onClick={() => setProxyMcpShowForm(false)}>取消</button>
              </div>
            </div>
          )}

          <p className={styles.hint}>此处配置的 MCP Server 仅供 Proxy Agent 使用。</p>

          {proxyMcpServers.length === 0 ? (
            <p className={styles.hint}>暂无 MCP Server 配置。</p>
          ) : (
            <div className={styles.kbDocList}>
              {proxyMcpServers.map((server) => (
                <div key={server.id} className={styles.skillItem} style={{ flexWrap: 'wrap' }}>
                  <div className={styles.kbDocInfo}>
                    <span className={styles.kbDocTitle}>
                      {server.type === 'remote' ? '🌐' : '📦'} {server.id}
                    </span>
                    <span className={styles.kbDocChunks}>
                      {server.type === 'remote'
                        ? server.url
                        : `${server.command} ${(server.args || []).slice(0, 2).join(' ')}`}
                      {(server.args || []).length > 2 && '...'}
                    </span>
                  </div>
                  <div className={styles.skillActions}>
                    <button
                      className={`${styles.toolToggleBtn} ${server.enabled !== false ? styles.toolEnabled : ''}`}
                      onClick={() => {
                        const updated = proxyMcpServers.map(s => s.id === server.id ? { ...s, enabled: !s.enabled } : s);
                        setProxyMcpServers(updated);
                        // 自动保存
                        setTimeout(() => handleProxyConfigSave(), 0);
                      }}
                      title={server.enabled !== false ? '已启用' : '已禁用'}
                    >
                      {server.enabled !== false ? '✅' : '⚪'}
                    </button>
                    <button
                      className={styles.skillEditBtn}
                      onClick={async () => {
                        if (proxyMcpToolsExpanded[server.id]) {
                          setProxyMcpToolsExpanded({ ...proxyMcpToolsExpanded, [server.id]: false });
                          return;
                        }
                        setProxyMcpLoadingTools({ ...proxyMcpLoadingTools, [server.id]: true });
                        try {
                          const result = await api.testMcpServer(server);
                          if (result.success && result.tools) {
                            setProxyMcpServerTools({ ...proxyMcpServerTools, [server.id]: result.tools });
                            setProxyMcpToolsExpanded({ ...proxyMcpToolsExpanded, [server.id]: true });
                          } else {
                            flash(`无法获取工具: ${result.error || '未知错误'}`);
                          }
                        } catch (err) {
                          flash(`获取工具失败: ${err instanceof Error ? err.message : String(err)}`);
                        } finally {
                          setProxyMcpLoadingTools({ ...proxyMcpLoadingTools, [server.id]: false });
                        }
                      }}
                      title="查看工具"
                      disabled={server.enabled === false || proxyMcpLoadingTools[server.id]}
                    >
                      {proxyMcpLoadingTools[server.id] ? '⏳' : '🛠️'}
                    </button>
                    <button
                      className={styles.skillEditBtn}
                      onClick={() => {
                        setProxyMcpEditingServer(server);
                        setProxyMcpDraft(server);
                        setProxyMcpEnvText(Object.entries(server.env || {}).map(([k, v]) => `${k}=${v}`).join('\n'));
                        setProxyMcpHeadersText(Object.entries(server.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n'));
                        setProxyMcpTestResult(null);
                        setProxyMcpShowForm(true);
                      }}
                      title="编辑"
                    >
                      ✏️
                    </button>
                    <button
                      className={styles.kbDocDelete}
                      onClick={() => {
                        const updated = proxyMcpServers.filter(s => s.id !== server.id);
                        setProxyMcpServers(updated);
                        // 自动保存
                        setTimeout(() => handleProxyConfigSave(), 0);
                      }}
                      title="删除"
                    >
                      ×
                    </button>
                  </div>
                  {/* 工具列表 */}
                  {proxyMcpServerTools[server.id] && proxyMcpServerTools[server.id].length > 0 && proxyMcpToolsExpanded[server.id] && (
                    <div style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '8px 12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                    }}>
                      <div
                        style={{ cursor: 'pointer', fontWeight: 500, marginBottom: '6px' }}
                        onClick={() => setProxyMcpToolsExpanded({ ...proxyMcpToolsExpanded, [server.id]: false })}
                      >
                        提供的工具 ({proxyMcpServerTools[server.id].length}) ▼
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {proxyMcpServerTools[server.id].map((tool) => (
                          <span
                            key={tool.name}
                            title={tool.description || tool.name}
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              backgroundColor: '#e0f2fe',
                              borderRadius: '12px',
                              fontSize: '12px',
                              color: '#0369a1',
                            }}
                          >
                            {tool.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </>
        )}

        </div>{/* end proxyTabPanel */}
        </div>{/* end panelBody */}
      </div>{/* end collapsiblePanel */}

      {/* ==================== 全局Tools ==================== */}
      <div className={styles.collapsiblePanel}>
        <div className={styles.panelHeader} onClick={() => toggleSection(2)}>
          <span className={styles.panelIcon}>🛠️</span>
          <div className={styles.panelTitleArea}>
            <h3 className={styles.panelTitle}>全局Tools</h3>
            <p className={styles.panelSubtitle}>{globalTools.length} 个工具</p>
          </div>
          <span className={`${styles.panelToggle} ${expandedSections.has(2) ? styles.expanded : ''}`}>▼</span>
        </div>
        <div className={expandedSections.has(2) ? styles.panelBody : styles.panelBodyHidden}>
          <p className={styles.hint} style={{ marginTop: 0 }}>
            全局Tools可被所有 Agent 使用。适合添加天气查询、搜索等通用能力。
          </p>
          <div style={{ marginBottom: '12px' }}>
            <button className={styles.addBtn} onClick={openGlobalToolCreate}>
              + 添加全局Tool
            </button>
          </div>

        {globalShowToolForm && (
          <div className={styles.kbImportForm}>
            {!globalEditingTool && (
              <label className={styles.field}>
                <span>Tool ID</span>
                <input
                  value={globalToolDraft.id}
                  onChange={(e) => setGlobalToolDraft({ ...globalToolDraft, id: e.target.value })}
                  placeholder="小写字母+连字符，如 search-web"
                  className={styles.input}
                />
              </label>
            )}
            <label className={styles.field}>
              <span>名称（Tool Name）</span>
              <input
                value={globalToolDraft.name}
                onChange={(e) => setGlobalToolDraft({ ...globalToolDraft, name: e.target.value })}
                placeholder="LLM 调用用的名称，如 search_web"
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span>描述</span>
              <input
                value={globalToolDraft.description}
                onChange={(e) => setGlobalToolDraft({ ...globalToolDraft, description: e.target.value })}
                placeholder="工具功能描述（展示给 LLM）"
                className={styles.input}
              />
            </label>

            {/* 参数定义 */}
            <div className={styles.toolParamsSection}>
              <div className={styles.toolParamsHeader}>
                <span className={styles.toolParamsLabel}>参数</span>
                <button className={styles.toolParamAddBtn} onClick={addGlobalToolParam} type="button">+ 添加</button>
              </div>
              {globalToolDraft.parameters.map((p, i) => (
                <div key={i} className={styles.toolParamRow}>
                  <input value={p.name} onChange={(e) => updateGlobalToolParam(i, 'name', e.target.value)} placeholder="参数名" className={styles.toolParamInput} />
                  <select value={p.type} onChange={(e) => updateGlobalToolParam(i, 'type', e.target.value)} className={styles.toolParamType}>
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                  </select>
                  <input value={p.description} onChange={(e) => updateGlobalToolParam(i, 'description', e.target.value)} placeholder="参数描述" className={styles.toolParamDesc} />
                  <label className={styles.toolParamReq} title="必填">
                    <input type="checkbox" checked={p.required !== false} onChange={(e) => updateGlobalToolParam(i, 'required', e.target.checked)} />
                    必填
                  </label>
                  <button className={styles.toolParamRemove} onClick={() => removeGlobalToolParam(i)} title="删除">×</button>
                </div>
              ))}
            </div>

            {/* Handler 类型选择 */}
            <div className={styles.toolHandlerSection}>
              <div className={styles.toolHandlerRow}>
                <span className={styles.toolParamsLabel}>Handler 类型</span>
                <select
                  value={globalToolDraft.handler.type}
                  onChange={(e) => {
                    const newType = e.target.value as 'http' | 'script';
                    if (newType === 'http') {
                      setGlobalToolDraft({ ...globalToolDraft, handler: { type: 'http', url: '', method: 'GET', headers: {}, bodyTemplate: '' } });
                      setGlobalHeadersText('');
                    } else {
                      setGlobalToolDraft({ ...globalToolDraft, handler: { type: 'script', scriptFile: '', runtime: 'node' } });
                    }
                    setGlobalScriptFile(null);
                  }}
                  className={styles.toolParamType}
                >
                  <option value="http">HTTP 请求</option>
                  <option value="script">脚本执行</option>
                </select>
              </div>

              {/* HTTP Handler */}
              {globalToolDraft.handler.type === 'http' && (() => {
                const h = globalToolDraft.handler as api.HttpHandler;
                return (
                  <>
                    <div className={styles.toolHandlerRow}>
                      <select value={h.method || 'GET'} onChange={(e) => setGlobalToolDraft({ ...globalToolDraft, handler: { ...h, method: e.target.value } })} className={styles.toolParamType}>
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                        <option value="PATCH">PATCH</option>
                      </select>
                      <input value={h.url} onChange={(e) => setGlobalToolDraft({ ...globalToolDraft, handler: { ...h, url: e.target.value } })} placeholder="https://api.example.com/{{query}}" className={styles.toolHandlerUrl} />
                    </div>
                    <label className={styles.field}>
                      <span>Headers（每行 key: value）</span>
                      <textarea value={globalHeadersText} onChange={(e) => setGlobalHeadersText(e.target.value)} placeholder="Authorization: Bearer xxx" rows={3} className={styles.kbTextarea} />
                    </label>
                    {['POST', 'PUT', 'PATCH'].includes(h.method || '') && (
                      <label className={styles.field}>
                        <span>Body Template</span>
                        <textarea value={h.bodyTemplate || ''} onChange={(e) => setGlobalToolDraft({ ...globalToolDraft, handler: { ...h, bodyTemplate: e.target.value } })} placeholder='{"query": "{{query}}"}' rows={3} className={styles.kbTextarea} />
                      </label>
                    )}
                  </>
                );
              })()}

              {/* Script Handler */}
              {globalToolDraft.handler.type === 'script' && (() => {
                const h = globalToolDraft.handler as api.ScriptHandler;
                return (
                  <>
                    <div className={styles.toolHandlerRow}>
                      <span className={styles.toolParamsLabel}>运行时</span>
                      <select value={h.runtime || 'node'} onChange={(e) => setGlobalToolDraft({ ...globalToolDraft, handler: { ...h, runtime: e.target.value as 'node' | 'python' | 'bash' } })} className={styles.toolParamType}>
                        <option value="node">Node.js</option>
                        <option value="python">Python</option>
                        <option value="bash">Bash</option>
                      </select>
                    </div>
                    <label className={styles.field}>
                      <span>超时（毫秒，默认 30000）</span>
                      <input type="number" value={h.timeout || 30000} onChange={(e) => setGlobalToolDraft({ ...globalToolDraft, handler: { ...h, timeout: Number(e.target.value) || 30000 } })} className={styles.input} />
                    </label>
                    <label className={styles.field}>
                      <span>脚本文件</span>
                      <input type="file" accept=".js,.ts,.py,.sh,.bash,.mjs,.cjs" onChange={(e) => setGlobalScriptFile(e.target.files?.[0] || null)} className={styles.input} />
                    </label>
                    {h.scriptFile && <p className={styles.hint}>当前脚本: {h.scriptFile}</p>}
                    <p className={styles.hint}>脚本通过 stdin 接收 JSON 参数，通过 stdout 返回结果。也可通过环境变量 TOOL_PARAMS 读取。</p>
                  </>
                );
              })()}
            </div>

            <div className={styles.kbImportActions}>
              <button className={styles.saveBtn} onClick={handleGlobalSaveTool} disabled={globalSavingTool}>
                {globalSavingTool ? '保存中…' : globalEditingTool ? '更新' : '创建'}
              </button>
              <button className={styles.cancelBtn} onClick={() => setGlobalShowToolForm(false)}>取消</button>
            </div>
          </div>
        )}

        {globalLoadingTools ? (
          <p className={styles.hint}>加载全局Tools中…</p>
        ) : globalTools.length === 0 && !globalShowToolForm ? (
          <p className={styles.hint}>暂无全局Tools。点击「添加全局Tool」配置新的工具。</p>
        ) : (
          <div className={styles.kbDocList}>
            {globalTools.map((tool) => (
              <div key={tool.id} className={styles.skillItem}>
                <div className={styles.kbDocInfo}>
                  <span className={styles.kbDocTitle}>🌐 {tool.name}</span>
                  <span className={styles.kbDocChunks}>
                    {tool.handler.type === 'http'
                      ? `${(tool.handler as api.HttpHandler).method || 'GET'} ${(tool.handler as api.HttpHandler).url.slice(0, 30)}`
                      : `📜 ${(tool.handler as api.ScriptHandler).runtime} · ${(tool.handler as api.ScriptHandler).scriptFile || '未上传'}`
                    }
                  </span>
                </div>
                <div className={styles.skillActions}>
                  <button
                    className={`${styles.toolToggleBtn} ${tool.enabled !== false ? styles.toolEnabled : ''}`}
                    onClick={() => handleGlobalToggleTool(tool)}
                    title={tool.enabled !== false ? '已启用' : '已禁用'}
                  >
                    {tool.enabled !== false ? '✅' : '⚪'}
                  </button>
                  <button className={styles.skillEditBtn} onClick={() => openGlobalToolEdit(tool)} title="编辑">✏️</button>
                  <button className={styles.kbDocDelete} onClick={() => handleGlobalDeleteTool(tool.id)} title="删除">×</button>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>{/* end panelBody */}
      </div>{/* end collapsiblePanel */}

      {/* ==================== 全局MCP Server ==================== */}
      <div className={styles.collapsiblePanel}>
        <div className={styles.panelHeader} onClick={() => toggleSection(3)}>
          <span className={styles.panelIcon}>🔌</span>
          <div className={styles.panelTitleArea}>
            <h3 className={styles.panelTitle}>全局MCP Server</h3>
            <p className={styles.panelSubtitle}>{mcpServers.length} 个服务器</p>
          </div>
          <span className={`${styles.panelToggle} ${expandedSections.has(3) ? styles.expanded : ''}`}>▼</span>
        </div>
        <div className={expandedSections.has(3) ? styles.panelBody : styles.panelBodyHidden}>
          <p className={styles.hint} style={{ marginTop: 0 }}>
            通过 MCP (Model Context Protocol) 连接外部工具服务器。全局MCP Server可被所有Agent使用。
          </p>
          <div style={{ marginBottom: '12px' }}>
            <button className={styles.addBtn} onClick={openMcpServerCreate}>
              + 添加 MCP Server
            </button>
          </div>

        {mcpShowForm && (
          <div className={styles.kbImportForm}>
            <h3>{mcpEditingServer ? '编辑 MCP Server' : '添加 MCP Server'}</h3>
            <label className={styles.field}>
              <span>Server ID（唯一标识）</span>
              <input
                type="text"
                value={mcpDraft.id}
                onChange={(e) => setMcpDraft({ ...mcpDraft, id: e.target.value })}
                className={styles.input}
                placeholder="e.g. filesystem"
                disabled={!!mcpEditingServer}
              />
            </label>

            <div className={styles.kbModeTabs}>
              <button
                className={`${styles.kbModeTab} ${(mcpDraft.type || 'local') === 'local' ? styles.kbModeActive : ''}`}
                onClick={() => setMcpDraft({ ...mcpDraft, type: 'local' })}
                disabled={!!mcpEditingServer}
              >
                📦 本地
              </button>
              <button
                className={`${styles.kbModeTab} ${mcpDraft.type === 'remote' ? styles.kbModeActive : ''}`}
                onClick={() => setMcpDraft({ ...mcpDraft, type: 'remote' })}
                disabled={!!mcpEditingServer}
              >
                🌐 远程
              </button>
            </div>

            <label className={styles.switchRow} style={{ marginBottom: '12px' }}>
              <span>启用</span>
              <input
                type="checkbox"
                checked={mcpDraft.enabled !== false}
                onChange={(e) => setMcpDraft({ ...mcpDraft, enabled: e.target.checked })}
              />
              <span className={`${styles.toggle} ${mcpDraft.enabled !== false ? styles.on : ''}`} />
            </label>

            {/* 本地 MCP Server 配置 */}
            {(mcpDraft.type || 'local') === 'local' && (
              <>
                {/* 安装 MCP 包区域 - 仅新增时显示 */}
                {!mcpEditingServer && (
                <div style={{
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #0ea5e9',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mcpShowInstall ? '12px' : 0 }}>
                    <span style={{ fontWeight: 500, color: '#0369a1' }}>📦 安装 npm 包（可选）</span>
                    <button
                      onClick={() => { setMcpShowInstall(!mcpShowInstall); if (!mcpShowInstall) loadInstalledPackages(); }}
                      style={{
                        background: mcpShowInstall ? '#e0f2fe' : '#0ea5e9',
                        color: mcpShowInstall ? '#0369a1' : 'white',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      {mcpShowInstall ? '收起' : '展开'}
                    </button>
                  </div>
                  {mcpShowInstall && (
                    <>
                      {mcpInstallError && (
                        <div style={{
                          backgroundColor: '#fee2e2',
                          border: '1px solid #ef4444',
                          borderRadius: '6px',
                          padding: '12px',
                          marginBottom: '12px',
                          color: '#dc2626',
                          fontSize: '13px',
                        }}>
                          <strong>❌ 安装失败：</strong>
                          <pre style={{ margin: '8px 0 0', fontSize: '12px', whiteSpace: 'pre-wrap', maxHeight: '150px', overflow: 'auto' }}>{mcpInstallError}</pre>
                          {mcpInstallNpmLog && (
                            <div style={{ marginTop: '12px' }}>
                              <button
                                onClick={() => setMcpShowNpmLog(!mcpShowNpmLog)}
                                style={{
                                  background: '#dc2626',
                                  color: 'white',
                                  border: 'none',
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                }}
                              >
                                {mcpShowNpmLog ? '隐藏详细日志' : '查看详细 npm 日志'}
                              </button>
                              {mcpShowNpmLog && (
                                <pre style={{
                                  marginTop: '8px',
                                  padding: '10px',
                                  backgroundColor: '#1e1e1e',
                                  color: '#d4d4d4',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  maxHeight: '300px',
                                  overflow: 'auto',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all',
                                }}>
                                  {mcpInstallNpmLog}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {mcpProbing && (
                        <div style={{
                          backgroundColor: '#fef3c7',
                          border: '1px solid #f59e0b',
                          borderRadius: '6px',
                          padding: '12px',
                          marginBottom: '12px',
                          color: '#92400e',
                          fontSize: '13px',
                        }}>
                          🔍 正在检测 MCP Tools...
                        </div>
                      )}
                      {mcpProbedTools.length > 0 && mcpProbedPackage && (
                        <div style={{
                          backgroundColor: '#d1fae5',
                          border: '1px solid #10b981',
                          borderRadius: '6px',
                          padding: '12px',
                          marginBottom: '12px',
                          color: '#065f46',
                          fontSize: '13px',
                        }}>
                          <strong>✅ {mcpProbedPackage} 安装成功！</strong>
                          <p style={{ margin: '8px 0 4px', fontWeight: 500 }}>检测到 {mcpProbedTools.length} 个可用 Tools：</p>
                          <ul style={{ margin: 0, paddingLeft: '20px', maxHeight: '150px', overflow: 'auto' }}>
                            {mcpProbedTools.map(tool => (
                              <li key={tool.name} style={{ marginBottom: '4px' }}>
                                <code style={{
                                  backgroundColor: '#047857',
                                  color: 'white',
                                  padding: '1px 6px',
                                  borderRadius: '3px',
                                  fontSize: '11px'
                                }}>{tool.name}</code>
                                {tool.description && (
                                  <span style={{ marginLeft: '6px', color: '#065f46', fontSize: '11px' }}>
                                    — {tool.description}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {mcpProbeError && !mcpProbedTools.length && (
                        <div style={{
                          backgroundColor: '#fef3c7',
                          border: '1px solid #f59e0b',
                          borderRadius: '6px',
                          padding: '12px',
                          marginBottom: '12px',
                          color: '#92400e',
                          fontSize: '13px',
                        }}>
                          <strong>⚠️ 包已安装，但 Tools 探测失败</strong>
                          <pre style={{ margin: '8px 0 0', fontSize: '11px', whiteSpace: 'pre-wrap' }}>{mcpProbeError}</pre>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input
                          type="text"
                          value={mcpInstallPackage}
                          onChange={(e) => setMcpInstallPackage(e.target.value)}
                          className={styles.input}
                          placeholder="包名 e.g. @modelcontextprotocol/server-filesystem"
                          style={{ flex: 1 }}
                        />
                        <button
                          onClick={handleMcpInstallPackage}
                          disabled={mcpInstalling || !mcpInstallPackage.trim()}
                          style={{
                            backgroundColor: mcpInstalling ? '#94a3b8' : '#0ea5e9',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            cursor: mcpInstalling ? 'not-allowed' : 'pointer',
                            fontSize: '13px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {mcpInstalling ? '安装中...' : '安装'}
                        </button>
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <input
                          type="text"
                          value={mcpInstallRegistry}
                          onChange={(e) => setMcpInstallRegistry(e.target.value)}
                          className={styles.input}
                          placeholder="npm registry（可选，如 https://registry.npmmirror.com）"
                          style={{ fontSize: '12px', color: '#64748b' }}
                        />
                      </div>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 8px' }}>
                        常用: @modelcontextprotocol/server-filesystem, server-github, server-puppeteer
                      </p>
                      {mcpInstalledPackages.length > 0 && (
                        <details style={{ fontSize: '12px', color: '#475569' }}>
                          <summary style={{ cursor: 'pointer' }}>已安装的 MCP 包 ({mcpInstalledPackages.length})</summary>
                          <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
                            {mcpInstalledPackages.map(pkg => (
                              <li key={pkg.name}>{pkg.name} <span style={{ color: '#888' }}>({pkg.version})</span></li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </>
                  )}
                </div>
                )}

                <label className={styles.field}>
                  <span>启动命令 *</span>
                  <input
                    type="text"
                    value={mcpDraft.command || ''}
                    onChange={(e) => setMcpDraft({ ...mcpDraft, command: e.target.value })}
                    className={styles.input}
                    placeholder="e.g. npx"
                  />
                </label>
                <label className={styles.field}>
                  <span>命令参数（每行一个）</span>
                  <textarea
                    value={mcpArgsText}
                    onChange={(e) => setMcpArgsText(e.target.value)}
                    className={styles.input}
                    rows={4}
                    placeholder={`-y\n@modelcontextprotocol/server-filesystem\nC:/Projects`}
                  />
                </label>
                <label className={styles.field}>
                  <span>环境变量（每行 KEY=VALUE）</span>
                  <textarea
                    value={mcpEnvText}
                    onChange={(e) => setMcpEnvText(e.target.value)}
                    className={styles.input}
                    rows={3}
                    placeholder={`API_KEY=your-key\nDEBUG=true`}
                  />
                </label>
                <p className={styles.hint}>
                  示例参数：<code>-y</code>、<code>@modelcontextprotocol/server-filesystem</code>、<code>C:/Projects</code>
                </p>
              </>
            )}

            {/* 远程 MCP Server 配置 */}
            {mcpDraft.type === 'remote' && (
              <>
                <label className={styles.field}>
                  <span>服务器 URL *</span>
                  <input
                    type="text"
                    value={mcpDraft.url || ''}
                    onChange={(e) => setMcpDraft({ ...mcpDraft, url: e.target.value })}
                    className={styles.input}
                    placeholder="e.g. https://mcp.example.com/sse"
                  />
                </label>
                <label className={styles.field}>
                  <span>请求头（每行 KEY=VALUE，用于认证等）</span>
                  <textarea
                    value={mcpHeadersText}
                    onChange={(e) => setMcpHeadersText(e.target.value)}
                    className={styles.input}
                    rows={3}
                    placeholder={`Authorization=Bearer your-token\nX-API-Key=your-key`}
                  />
                </label>
                <p className={styles.hint}>
                  🌐 远程 MCP Server 通过 SSE (Server-Sent Events) 协议连接。
                  确保服务器支持 MCP over SSE 协议。
                </p>
              </>
            )}

            <label className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
              <span>启用</span>
              <input
                type="checkbox"
                checked={mcpDraft.enabled !== false}
                onChange={(e) => setMcpDraft({ ...mcpDraft, enabled: e.target.checked })}
              />
            </label>
            <p className={styles.hint}>
              常用 MCP Server: @modelcontextprotocol/server-filesystem（文件系统）、
              @modelcontextprotocol/server-github（GitHub）等。
              <a href="https://modelcontextprotocol.io/" target="_blank" rel="noreferrer"> 了解更多 →</a>
            </p>
            {/* 测试结果显示 */}
            {mcpTestResult && (
              <div style={{
                marginTop: '12px',
                marginBottom: '12px',
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: mcpTestResult.success ? '#d1fae5' : '#fee2e2',
                border: `1px solid ${mcpTestResult.success ? '#10b981' : '#ef4444'}`,
              }}>
                {mcpTestResult.success ? (
                  <>
                    <strong style={{ color: '#065f46' }}>✅ 测试成功！</strong>
                    <p style={{ margin: '8px 0 4px', fontWeight: 500, color: '#065f46' }}>
                      检测到 {mcpTestResult.tools.length} 个可用 Tools：
                    </p>
                    {mcpTestResult.tools.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: '20px', maxHeight: '150px', overflow: 'auto', fontSize: '12px' }}>
                        {mcpTestResult.tools.map(tool => (
                          <li key={tool.name} style={{ marginBottom: '2px' }}>
                            <code style={{
                              backgroundColor: '#047857',
                              color: 'white',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              fontSize: '11px'
                            }}>{tool.name}</code>
                            {tool.description && (
                              <span style={{ marginLeft: '6px', color: '#065f46', fontSize: '11px' }}>
                                — {tool.description.slice(0, 60)}{tool.description.length > 60 ? '...' : ''}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <>
                    <strong style={{ color: '#dc2626' }}>❌ 测试失败</strong>
                    <pre style={{
                      margin: '8px 0 0',
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      color: '#dc2626',
                      maxHeight: '150px',
                      overflow: 'auto',
                    }}>{mcpTestResult.error}</pre>
                  </>
                )}
              </div>
            )}
            <div className={styles.kbImportActions}>
              <button
                className={styles.saveBtn}
                style={{ backgroundColor: '#6366f1' }}
                onClick={async () => {
                  const serverType = mcpDraft.type || 'local';
                  if (serverType === 'local' && !mcpDraft.command) {
                    flash('❌ 本地 MCP Server 需要填写启动命令');
                    return;
                  }
                  if (serverType === 'remote' && !mcpDraft.url) {
                    flash('❌ 远程 MCP Server 需要填写 URL');
                    return;
                  }
                  setMcpTesting(true);
                  setMcpTestResult(null);
                  try {
                    const testConfig: api.McpServerConfig = {
                      ...mcpDraft,
                      args: mcpArgsText.split('\n').map(s => s.trim()).filter(Boolean),
                      env: mcpEnvText.split('\n').filter(l => l.includes('=')).reduce((acc, l) => {
                        const [k, ...v] = l.split('=');
                        acc[k.trim()] = v.join('=').trim();
                        return acc;
                      }, {} as Record<string, string>),
                      headers: mcpHeadersText.split('\n').filter(l => l.includes('=')).reduce((acc, l) => {
                        const [k, ...v] = l.split('=');
                        acc[k.trim()] = v.join('=').trim();
                        return acc;
                      }, {} as Record<string, string>),
                    };
                    const result = await api.testMcpServer(testConfig);
                    setMcpTestResult(result);
                    if (result.success) {
                      flash(`✅ 测试成功，发现 ${result.tools.length} 个 Tools`);
                    } else {
                      flash('❌ 测试失败: ' + result.error);
                    }
                  } catch (e) {
                    const err = e instanceof Error ? e.message : String(e);
                    setMcpTestResult({ success: false, serverId: mcpDraft.id, testTime: new Date().toISOString(), tools: [], error: err });
                    flash('❌ 测试出错: ' + err);
                  } finally {
                    setMcpTesting(false);
                  }
                }}
                disabled={mcpTesting || !mcpDraft.id}
              >
                {mcpTesting ? '测试中…' : '🔍 测试连接'}
              </button>
              <button className={styles.saveBtn} onClick={handleMcpSaveServer} disabled={mcpSavingServer}>
                {mcpSavingServer ? '保存中…' : mcpEditingServer ? '更新' : '创建'}
              </button>
              <button className={styles.cancelBtn} onClick={() => { setMcpShowForm(false); setMcpTestResult(null); }}>取消</button>
            </div>
          </div>
        )}

        {mcpLoadingServers ? (
          <p className={styles.hint}>加载 MCP Server 中…</p>
        ) : mcpServers.length === 0 && !mcpShowForm ? (
          <p className={styles.hint}>暂无 MCP Server。点击「添加 MCP Server」配置新的服务器。</p>
        ) : (
          <div className={styles.kbDocList}>
            {mcpServers.map((server) => (
              <div key={server.id} className={styles.skillItem} style={{ flexWrap: 'wrap' }}>
                <div className={styles.kbDocInfo}>
                  <span className={styles.kbDocTitle}>
                    {server.type === 'remote' ? '🌐' : '📦'} {server.id}
                  </span>
                  <span className={styles.kbDocChunks}>
                    {server.type === 'remote'
                      ? server.url
                      : `${server.command} ${(server.args || []).slice(0, 2).join(' ')}`}
                    {(server.args || []).length > 2 && '...'}
                  </span>
                </div>
                <div className={styles.skillActions}>
                  <button
                    className={`${styles.toolToggleBtn} ${server.enabled !== false ? styles.toolEnabled : ''}`}
                    onClick={() => handleMcpToggleServer(server)}
                    title={server.enabled !== false ? '已启用' : '已禁用'}
                  >
                    {server.enabled !== false ? '✅' : '⚪'}
                  </button>
                  <button
                    className={styles.skillEditBtn}
                    onClick={() => loadMcpServerToolsList(server.id)}
                    title="查看工具"
                    disabled={server.enabled === false || mcpLoadingTools[server.id]}
                  >
                    {mcpLoadingTools[server.id] ? '⏳' : '🛠️'}
                  </button>
                  <button className={styles.skillEditBtn} onClick={() => openMcpServerEdit(server)} title="编辑">✏️</button>
                  <button className={styles.kbDocDelete} onClick={() => handleMcpDeleteServer(server.id)} title="删除">×</button>
                </div>
                {/* 显示该 server 的工具列表 - 新的一行 */}
                {mcpServerTools[server.id] && mcpServerTools[server.id].length > 0 && (
                  <div style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                  }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                      onClick={() => setMcpToolsExpanded(prev => ({ ...prev, [server.id]: !prev[server.id] }))}
                    >
                      <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                        🛠️ 提供的工具 ({mcpServerTools[server.id].length})
                      </span>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {mcpToolsExpanded[server.id] ? '▲ 收起' : '▼ 展开'}
                      </span>
                    </div>
                    {mcpToolsExpanded[server.id] && (
                      <ul style={{
                        margin: '8px 0 0',
                        paddingLeft: '20px',
                        fontSize: '12px',
                        color: '#334155',
                        maxHeight: '200px',
                        overflow: 'auto',
                      }}>
                        {mcpServerTools[server.id].map((tool) => (
                          <li key={tool.name} style={{ marginBottom: '4px' }}>
                            <strong>{tool.name}</strong>
                            {tool.description && (
                              <span style={{ color: '#64748b' }}>
                                {' '}— {tool.description.slice(0, 80)}{tool.description.length > 80 ? '...' : ''}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>{/* end panelBody */}
      </div>{/* end collapsiblePanel */}
    </div>{/* end pageInner */}
    </div>
  );
}
