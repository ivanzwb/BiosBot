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
  const [proxyModel, setProxyModel] = useState('');
  const [proxyTab, setProxyTab] = useState<'basic' | 'prompt' | 'skills' | 'tools' | 'kb'>('basic');
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

  useEffect(() => {
    loadData();
    loadProxyDocs();
    loadProxySkills();
    loadProxyTools();
    loadGlobalTools();
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

  const handleProxyClearKb = async () => {
    try {
      await api.clearKnowledge('proxy-agent');
      flash('已清空知识库');
      setProxyDocs([]);
      setProxyKbHasData(false);
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

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>模型管理</h2>
            <p className={styles.hint}>
              添加兼容 OpenAI API 的模型配置。配置好的模型可在 Agent 中选择使用。
            </p>
          </div>
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
      </section>

      <section className={styles.section}>
        <h2>Proxy Agent 配置</h2>
        <p className={styles.hint}>
          Proxy Agent 负责意图识别与任务路由，可单独指定使用的模型、提示词、技能、工具和知识库。
        </p>

        <div className={styles.proxyTabBar}>
          {[
            { id: 'basic' as const, label: '基本配置' },
            { id: 'prompt' as const, label: 'Prompt' },
            { id: 'skills' as const, label: 'Skills' },
            { id: 'tools' as const, label: 'Tools' },
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

        </div>{/* end proxyTabPanel */}
      </section>

      {/* ==================== 全局Tools ==================== */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>全局Tools</h2>
            <p className={styles.hint}>
              全局Tools可被所有 Agent 使用。适合添加天气查询、搜索等通用能力。
            </p>
          </div>
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
      </section>
    </div>{/* end pageInner */}
    </div>
  );
}
