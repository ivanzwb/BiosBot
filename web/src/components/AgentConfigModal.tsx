import { useEffect, useState, useCallback } from 'react';
import * as api from '../services/api';
import styles from './AgentConfigModal.module.css';

interface ModelProvider {
  id: string;
  name: string;
  model: string;
}

interface AgentModelMapping {
  defaultModel?: string;
  agents?: Record<string, { enabled?: boolean; model?: string }>;
}

interface Props {
  agent: api.AgentInfo;
  onClose: () => void;
  onSaved: () => void;
}

export default function AgentConfigModal({ agent, onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<'basic' | 'prompt' | 'skills' | 'tools' | 'kb'>('basic');
  const [model, setModel] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [defaultModelId, setDefaultModelId] = useState('');
  const [models, setModels] = useState<ModelProvider[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Agent 基本信息
  const [agentName, setAgentName] = useState(agent.name);
  const [agentDesc, setAgentDesc] = useState(agent.description);
  const [agentLabels, setAgentLabels] = useState((agent.labels || []).join(', '));
  const [agentTemp, setAgentTemp] = useState(agent.defaultTemperature ?? 0.5);
  const [agentPrompt, setAgentPrompt] = useState(agent.systemPrompt || '');

  // Skill 状态
  const [skills, setSkills] = useState<api.SkillInfo[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState<api.SkillInfo | null>(null);
  const [skillDraft, setSkillDraft] = useState({ id: '', name: '', description: '', content: '' });
  const [savingSkill, setSavingSkill] = useState(false);

  // Tool 状态
  const [tools, setTools] = useState<api.AgentToolConfig[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [showToolForm, setShowToolForm] = useState(false);
  const [editingTool, setEditingTool] = useState<api.AgentToolConfig | null>(null);
  const [toolDraft, setToolDraft] = useState<api.AgentToolConfig>({
    id: '', name: '', description: '', parameters: [],
    handler: { type: 'http', url: '', method: 'GET', headers: {}, bodyTemplate: '' },
    enabled: true,
  });
  const [savingTool, setSavingTool] = useState(false);
  // 临时的 headers 编辑字符串（key: value 每行一个）
  const [headersText, setHeadersText] = useState('');
  // 脚本文件（待上传）
  const [scriptFile, setScriptFile] = useState<File | null>(null);

  // 知识库状态
  const [docs, setDocs] = useState<api.DocumentSummary[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [kbHasData, setKbHasData] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importTitle, setImportTitle] = useState('');
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<'text' | 'file'>('file');
  const [importFiles, setImportFiles] = useState<File[]>([]);

  // Load current config + models list
  useEffect(() => {
    Promise.all([
      api.getConfig('agent_model_mapping'),
      api.getConfig('models').catch(() => null),
    ])
      .then(([mappingCfg, modelsCfg]) => {
        const mapping: AgentModelMapping = JSON.parse(mappingCfg.value);
        const agentCfg = mapping.agents?.[agent.id];
        const list = modelsCfg ? JSON.parse(modelsCfg.value) || [] : [];

        // 兼容旧格式: { provider, model } → 取 model 字段
        const dm: any = mapping.defaultModel;
        setDefaultModelId(typeof dm === 'string' ? dm : (dm?.model || dm?.id || ''));
        const am: any = agentCfg?.model;
        setModel(typeof am === 'string' ? am : (am?.model || am?.id || ''));
        setEnabled(agentCfg?.enabled !== false);
        setModels(Array.isArray(list) ? list : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agent.id]);

  // 加载 Skills
  const loadSkills = useCallback(() => {
    setLoadingSkills(true);
    api.listSkills(agent.id)
      .then(setSkills)
      .catch(() => setSkills([]))
      .finally(() => setLoadingSkills(false));
  }, [agent.id]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const openCreateSkill = () => {
    setEditingSkill(null);
    setSkillDraft({ id: '', name: '', description: '', content: '' });
    setShowSkillForm(true);
  };

  const openEditSkill = (skill: api.SkillInfo) => {
    setEditingSkill(skill);
    setSkillDraft({ id: skill.id, name: skill.name, description: skill.description, content: skill.content });
    setShowSkillForm(true);
  };

  const handleSaveSkill = async () => {
    if (!skillDraft.id.trim() || !skillDraft.name.trim() || !skillDraft.content.trim()) {
      setToast('Skill ID、名称和内容不能为空');
      return;
    }
    setSavingSkill(true);
    try {
      if (editingSkill) {
        await api.updateSkill(agent.id, editingSkill.id, {
          name: skillDraft.name.trim(),
          description: skillDraft.description.trim(),
          content: skillDraft.content.trim(),
        });
        setToast('Skill 已更新');
      } else {
        await api.createSkill(agent.id, {
          id: skillDraft.id.trim(),
          name: skillDraft.name.trim(),
          description: skillDraft.description.trim(),
          content: skillDraft.content.trim(),
        });
        setToast('Skill 已创建');
      }
      setShowSkillForm(false);
      loadSkills();
    } catch (err) {
      setToast(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingSkill(false);
    }
  };

  const handleDeleteSkill = async (skillId: string) => {
    if (!confirm('确认删除此 Skill？')) return;
    try {
      await api.deleteSkill(agent.id, skillId);
      setSkills((prev) => prev.filter((s) => s.id !== skillId));
      setToast('Skill 已删除');
    } catch (err) {
      setToast(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 加载 Tools
  const loadTools = useCallback(() => {
    setLoadingTools(true);
    api.listTools(agent.id)
      .then(setTools)
      .catch(() => setTools([]))
      .finally(() => setLoadingTools(false));
  }, [agent.id]);

  useEffect(() => { loadTools(); }, [loadTools]);

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

  const openCreateTool = () => {
    setEditingTool(null);
    setToolDraft({
      id: '', name: '', description: '', parameters: [],
      handler: { type: 'http', url: '', method: 'GET', headers: {}, bodyTemplate: '' },
      enabled: true,
    });
    setHeadersText('');
    setScriptFile(null);
    setShowToolForm(true);
  };

  const openEditTool = (tool: api.AgentToolConfig) => {
    setEditingTool(tool);
    setToolDraft({ ...tool });
    setHeadersText(tool.handler.type === 'http' ? headersToText(tool.handler.headers) : '');
    setScriptFile(null);
    setShowToolForm(true);
  };

  const handleSaveTool = async () => {
    if (!toolDraft.id.trim() || !toolDraft.name.trim() || !toolDraft.description.trim()) {
      setToast('Tool ID、名称和描述不能为空');
      return;
    }
    const hType = toolDraft.handler.type;
    if (hType === 'http' && !(toolDraft.handler as api.HttpHandler).url.trim()) {
      setToast('Handler URL 不能为空');
      return;
    }
    if (hType === 'script' && !editingTool && !scriptFile) {
      setToast('请选择要上传的脚本文件');
      return;
    }
    setSavingTool(true);
    try {
      let payload: any;
      if (hType === 'http') {
        payload = { ...toolDraft, handler: { ...toolDraft.handler, headers: textToHeaders(headersText) } };
      } else {
        payload = { ...toolDraft };
      }

      let savedToolId = toolDraft.id.trim();
      if (editingTool) {
        const { id: _, ...fields } = payload;
        await api.updateTool(agent.id, editingTool.id, fields);
        savedToolId = editingTool.id;
        setToast('Tool 已更新');
      } else {
        await api.createTool(agent.id, payload);
        setToast('Tool 已创建');
      }

      // 如果有脚本文件需要上传
      if (hType === 'script' && scriptFile) {
        await api.uploadToolScript(agent.id, savedToolId, scriptFile);
        setToast(editingTool ? 'Tool 已更新（脚本已上传）' : 'Tool 已创建（脚本已上传）');
      }

      setShowToolForm(false);
      loadTools();
    } catch (err) {
      setToast(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingTool(false);
    }
  };

  const handleDeleteTool = async (toolId: string) => {
    if (!confirm('确认删除此 Tool？')) return;
    try {
      await api.deleteTool(agent.id, toolId);
      setTools((prev) => prev.filter((t) => t.id !== toolId));
      setToast('Tool 已删除');
    } catch (err) {
      setToast(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleToggleTool = async (tool: api.AgentToolConfig) => {
    try {
      await api.updateTool(agent.id, tool.id, { enabled: !tool.enabled });
      loadTools();
    } catch (err) {
      setToast(`切换失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const addToolParam = () => {
    setToolDraft({
      ...toolDraft,
      parameters: [...toolDraft.parameters, { name: '', type: 'string', description: '', required: true }],
    });
  };

  const updateToolParam = (index: number, field: string, value: string | boolean) => {
    const params = [...toolDraft.parameters];
    (params[index] as any)[field] = value;
    setToolDraft({ ...toolDraft, parameters: params });
  };

  const removeToolParam = (index: number) => {
    const params = toolDraft.parameters.filter((_, i) => i !== index);
    setToolDraft({ ...toolDraft, parameters: params });
  };

  // 加载知识库文档
  const loadDocs = useCallback(() => {
    setLoadingDocs(true);
    Promise.all([
      api.listKnowledgeDocs(agent.id).catch(() => []),
      api.getKnowledgeStatus(agent.id).catch(() => null),
    ]).then(([docList, status]) => {
      setDocs(docList);
      setKbHasData(status?.hasData ?? docList.length > 0);
    }).finally(() => setLoadingDocs(false));
  }, [agent.id]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('确认删除此文档？')) return;
    try {
      await api.deleteKnowledgeDoc(agent.id, docId);
      setDocs((prev) => prev.filter((d) => d.docId !== docId));
      setToast('文档已删除');
    } catch (err) {
      setToast(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleClearKb = async () => {
    if (!confirm('确认清空全部知识库？此操作不可撤销。')) return;
    try {
      await api.clearKnowledge(agent.id);
      setDocs([]);
      setKbHasData(false);
      setToast('知识库已清空');
    } catch (err) {
      setToast(`清空失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleImport = async () => {
    if (importMode === 'text' && !importText.trim()) return;
    if (importMode === 'file' && importFiles.length === 0) return;
    setImporting(true);
    try {
      const documents: { id: string; title: string; content: string }[] = [];

      if (importMode === 'file') {
        for (const file of importFiles) {
          const content = await file.text();
          documents.push({
            id: `file_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
            title: file.name,
            content,
          });
        }
      } else {
        documents.push({
          id: `manual_${Date.now()}`,
          title: importTitle || '手动导入',
          content: importText,
        });
      }

      await api.ingestDocuments(agent.id, documents);
      setToast(`${documents.length} 个文档已提交导入，正在向量化…`);
      setShowImport(false);
      setImportTitle('');
      setImportText('');
      setImportFiles([]);
      setTimeout(loadDocs, 3000);
    } catch (err) {
      setToast(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. 保存模型映射 & 启用状态
      const cfg = await api.getConfig('agent_model_mapping');
      const mapping: AgentModelMapping = JSON.parse(cfg.value);

      if (!mapping.agents) mapping.agents = {};
      if (!mapping.agents[agent.id]) mapping.agents[agent.id] = {};

      mapping.agents[agent.id].enabled = enabled;

      if (model) {
        mapping.agents[agent.id].model = model;
      } else {
        delete mapping.agents[agent.id].model;
      }

      await api.updateConfig('agent_model_mapping', JSON.stringify(mapping));

      // 2. 保存 Agent 基本配置（name, description, labels, temperature, prompt）
      const labels = agentLabels
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      await api.updateAgentConfig(agent.id, {
        name: agentName.trim() || agent.name,
        description: agentDesc.trim(),
        labels,
        defaultTemperature: agentTemp,
        systemPrompt: agentPrompt.trim(),
      });

      setToast('已保存');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 600);
    } catch (err) {
      setToast(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const defaultEntry = models.find((m) => m.id === defaultModelId);
  const defaultDisplay = defaultEntry
    ? `${defaultEntry.name} (${defaultEntry.model})`
    : defaultModelId || '未配置';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>配置 {agent.name}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className={styles.loadingText}>加载中…</div>
        ) : (
          <div className={styles.body}>
            <div className={styles.idRow}>
              <span className={styles.idLabel}>Agent ID</span>
              <code className={styles.idValue}>{agent.id}</code>
            </div>

            <label className={styles.switchRow}>
              <span>启用</span>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className={`${styles.toggle} ${enabled ? styles.on : ''}`} />
            </label>

            {/* ===== 横向 Tab 导航 ===== */}
            <div className={styles.tabBar}>
              {[
                { id: 'basic' as const, label: '基本配置' },
                { id: 'prompt' as const, label: 'Prompt' },
                { id: 'skills' as const, label: 'Skills' },
                { id: 'tools' as const, label: 'Tools' },
                { id: 'kb' as const, label: '知识库' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`${styles.tabItem} ${activeTab === tab.id ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className={styles.tabPanel}>

            {/* ===== Tab: 基本配置 ===== */}
            {activeTab === 'basic' && (
              <>

              <label className={styles.field}>
                <span>模型</span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={styles.select}
                >
                  <option value="">使用默认 ({defaultDisplay})</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.model})
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>名称</span>
                <input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Agent 显示名称"
                  className={styles.select}
                />
              </label>

              <label className={styles.field}>
                <span>描述</span>
                <input
                  value={agentDesc}
                  onChange={(e) => setAgentDesc(e.target.value)}
                  placeholder="Agent 功能描述"
                  className={styles.select}
                />
              </label>

              <label className={styles.field}>
                <span>标签</span>
                <input
                  value={agentLabels}
                  onChange={(e) => setAgentLabels(e.target.value)}
                  placeholder="用逗号分隔，如：推荐, 解析, 分析"
                  className={styles.select}
                />
              </label>

              <label className={styles.field}>
                <span>Temperature</span>
                <div className={styles.tempRow}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={agentTemp}
                    onChange={(e) => setAgentTemp(Number(e.target.value))}
                    className={styles.tempSlider}
                  />
                  <span className={styles.tempValue}>{agentTemp}</span>
                </div>
              </label>
              </>
            )}

            {/* ===== Tab: System Prompt ===== */}
            {activeTab === 'prompt' && (
              <>
              <label className={styles.field}>
                <span>System Prompt</span>
                <textarea
                  value={agentPrompt}
                  onChange={(e) => setAgentPrompt(e.target.value)}
                  placeholder="定义 Agent 的人设和能力范围…"
                  rows={12}
                  className={styles.kbTextarea}
                />
              </label>
              </>
            )}

            {/* ===== Tab: Skills 管理 ===== */}
            {activeTab === 'skills' && (
              <>
              <div className={styles.kbActions}>
                <button className={styles.kbImportBtn} onClick={openCreateSkill}>➕ 添加 Skill</button>
                <button className={styles.kbRefreshBtn} onClick={loadSkills}>🔄</button>
              </div>

              {showSkillForm && (
                <div className={styles.kbImportForm}>
                  {!editingSkill && (
                    <label className={styles.field}>
                      <span>Skill ID</span>
                      <input
                        value={skillDraft.id}
                        onChange={(e) => setSkillDraft({ ...skillDraft, id: e.target.value })}
                        placeholder="小写字母+连字符，如 calculate-metrics"
                        className={styles.select}
                      />
                    </label>
                  )}
                  <label className={styles.field}>
                    <span>名称</span>
                    <input
                      value={skillDraft.name}
                      onChange={(e) => setSkillDraft({ ...skillDraft, name: e.target.value })}
                      placeholder="Skill 显示名称"
                      className={styles.select}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>描述</span>
                    <input
                      value={skillDraft.description}
                      onChange={(e) => setSkillDraft({ ...skillDraft, description: e.target.value })}
                      placeholder="Skill 功能描述（供路由决策）"
                      className={styles.select}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>内容（Markdown）</span>
                    <textarea
                      value={skillDraft.content}
                      onChange={(e) => setSkillDraft({ ...skillDraft, content: e.target.value })}
                      placeholder="Skill 正文内容，将注入到 LLM prompt 中…"
                      rows={8}
                      className={styles.kbTextarea}
                    />
                  </label>
                  <div className={styles.kbImportActions}>
                    <button className={styles.saveBtn} onClick={handleSaveSkill} disabled={savingSkill}>
                      {savingSkill ? '保存中…' : editingSkill ? '更新' : '创建'}
                    </button>
                    <button className={styles.cancelBtn} onClick={() => setShowSkillForm(false)}>取消</button>
                  </div>
                </div>
              )}

              {loadingSkills ? (
                <p className={styles.hint}>加载 Skills 中…</p>
              ) : skills.length === 0 ? (
                <p className={styles.hint}>暂无 Skill。点击「添加 Skill」创建新的技能。</p>
              ) : (
                <div className={styles.kbDocList}>
                  {skills.map((skill) => (
                    <div key={skill.id} className={styles.skillItem}>
                      <div className={styles.kbDocInfo}>
                        <span className={styles.kbDocTitle}>{skill.name}</span>
                        <span className={styles.kbDocChunks}>{skill.id}</span>
                      </div>
                      <div className={styles.skillActions}>
                        <button
                          className={styles.skillEditBtn}
                          onClick={() => openEditSkill(skill)}
                          title="编辑"
                        >
                          ✏️
                        </button>
                        <button
                          className={styles.kbDocDelete}
                          onClick={() => handleDeleteSkill(skill.id)}
                          title="删除"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </>
            )}

            {/* ===== Tab: Tools 管理 ===== */}
            {activeTab === 'tools' && (
              <>
              <p className={styles.hint}>
                配置 Agent 可调用的外部工具（HTTP API 或脚本），LLM 会根据工具描述自动决定是否调用。
              </p>
              <div className={styles.kbActions}>
                <button className={styles.kbImportBtn} onClick={openCreateTool}>➕ 添加 Tool</button>
                <button className={styles.kbRefreshBtn} onClick={loadTools}>🔄</button>
              </div>

              {showToolForm && (
                <div className={styles.kbImportForm}>
                  {!editingTool && (
                    <label className={styles.field}>
                      <span>Tool ID</span>
                      <input
                        value={toolDraft.id}
                        onChange={(e) => setToolDraft({ ...toolDraft, id: e.target.value })}
                        placeholder="小写字母+连字符，如 search-web"
                        className={styles.select}
                      />
                    </label>
                  )}
                  <label className={styles.field}>
                    <span>名称（Tool Name）</span>
                    <input
                      value={toolDraft.name}
                      onChange={(e) => setToolDraft({ ...toolDraft, name: e.target.value })}
                      placeholder="LLM 调用用的名称，如 search_web"
                      className={styles.select}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>描述</span>
                    <input
                      value={toolDraft.description}
                      onChange={(e) => setToolDraft({ ...toolDraft, description: e.target.value })}
                      placeholder="工具功能描述（展示给 LLM）"
                      className={styles.select}
                    />
                  </label>

                  {/* 参数定义 */}
                  <div className={styles.toolParamsSection}>
                    <div className={styles.toolParamsHeader}>
                      <span className={styles.toolParamsLabel}>参数</span>
                      <button className={styles.toolParamAddBtn} onClick={addToolParam} type="button">+ 添加</button>
                    </div>
                    {toolDraft.parameters.map((p, i) => (
                      <div key={i} className={styles.toolParamRow}>
                        <input
                          value={p.name}
                          onChange={(e) => updateToolParam(i, 'name', e.target.value)}
                          placeholder="参数名"
                          className={styles.toolParamInput}
                        />
                        <select
                          value={p.type}
                          onChange={(e) => updateToolParam(i, 'type', e.target.value)}
                          className={styles.toolParamType}
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                        </select>
                        <input
                          value={p.description}
                          onChange={(e) => updateToolParam(i, 'description', e.target.value)}
                          placeholder="参数描述"
                          className={styles.toolParamDesc}
                        />
                        <label className={styles.toolParamReq} title="必填">
                          <input
                            type="checkbox"
                            checked={p.required !== false}
                            onChange={(e) => updateToolParam(i, 'required', e.target.checked)}
                          />
                          必填
                        </label>
                        <button className={styles.toolParamRemove} onClick={() => removeToolParam(i)} title="删除">×</button>
                      </div>
                    ))}
                  </div>

                  {/* Handler 类型选择 */}
                  <div className={styles.toolHandlerSection}>
                    <div className={styles.toolHandlerRow}>
                      <span className={styles.toolParamsLabel}>Handler 类型</span>
                      <select
                        value={toolDraft.handler.type}
                        onChange={(e) => {
                          const newType = e.target.value as 'http' | 'script';
                          if (newType === 'http') {
                            setToolDraft({ ...toolDraft, handler: { type: 'http', url: '', method: 'GET', headers: {}, bodyTemplate: '' } });
                            setHeadersText('');
                          } else {
                            setToolDraft({ ...toolDraft, handler: { type: 'script', scriptFile: '', runtime: 'node' } });
                          }
                          setScriptFile(null);
                        }}
                        className={styles.toolParamType}
                      >
                        <option value="http">HTTP 请求</option>
                        <option value="script">脚本执行</option>
                      </select>
                    </div>

                    {/* --- HTTP Handler 配置 --- */}
                    {toolDraft.handler.type === 'http' && (() => {
                      const h = toolDraft.handler as api.HttpHandler;
                      return (
                        <>
                          <div className={styles.toolHandlerRow}>
                            <select
                              value={h.method || 'GET'}
                              onChange={(e) => setToolDraft({ ...toolDraft, handler: { ...h, method: e.target.value } })}
                              className={styles.toolParamType}
                            >
                              <option value="GET">GET</option>
                              <option value="POST">POST</option>
                              <option value="PUT">PUT</option>
                              <option value="DELETE">DELETE</option>
                              <option value="PATCH">PATCH</option>
                            </select>
                            <input
                              value={h.url}
                              onChange={(e) => setToolDraft({ ...toolDraft, handler: { ...h, url: e.target.value } })}
                              placeholder="https://api.example.com/{{query}}"
                              className={styles.toolHandlerUrl}
                            />
                          </div>
                          <label className={styles.field}>
                            <span>Headers（每行 key: value）</span>
                            <textarea
                              value={headersText}
                              onChange={(e) => setHeadersText(e.target.value)}
                              placeholder="Authorization: Bearer xxx&#10;Content-Type: application/json"
                              rows={3}
                              className={styles.kbTextarea}
                            />
                          </label>
                          {['POST', 'PUT', 'PATCH'].includes(h.method || '') && (
                            <label className={styles.field}>
                              <span>Body Template</span>
                              <textarea
                                value={h.bodyTemplate || ''}
                                onChange={(e) => setToolDraft({ ...toolDraft, handler: { ...h, bodyTemplate: e.target.value } })}
                                placeholder='{"query": "{{query}}"}'
                                rows={3}
                                className={styles.kbTextarea}
                              />
                            </label>
                          )}
                        </>
                      );
                    })()}

                    {/* --- Script Handler 配置 --- */}
                    {toolDraft.handler.type === 'script' && (() => {
                      const h = toolDraft.handler as api.ScriptHandler;
                      return (
                        <>
                          <div className={styles.toolHandlerRow}>
                            <span className={styles.toolParamsLabel}>运行时</span>
                            <select
                              value={h.runtime || 'node'}
                              onChange={(e) => setToolDraft({ ...toolDraft, handler: { ...h, runtime: e.target.value as 'node' | 'python' | 'bash' } })}
                              className={styles.toolParamType}
                            >
                              <option value="node">Node.js</option>
                              <option value="python">Python</option>
                              <option value="bash">Bash</option>
                            </select>
                          </div>
                          <label className={styles.field}>
                            <span>超时（毫秒，默认 30000）</span>
                            <input
                              type="number"
                              value={h.timeout || 30000}
                              onChange={(e) => setToolDraft({ ...toolDraft, handler: { ...h, timeout: Number(e.target.value) || 30000 } })}
                              className={styles.select}
                            />
                          </label>
                          <label className={styles.field}>
                            <span>脚本文件</span>
                            <input
                              type="file"
                              accept=".js,.ts,.py,.sh,.bash,.mjs,.cjs"
                              onChange={(e) => setScriptFile(e.target.files?.[0] || null)}
                              className={styles.select}
                            />
                          </label>
                          {h.scriptFile && (
                            <p className={styles.hint}>当前脚本: {h.scriptFile}</p>
                          )}
                          <p className={styles.hint}>
                            脚本通过 stdin 接收 JSON 参数，通过 stdout 返回结果。也可通过环境变量 TOOL_PARAMS 读取参数 JSON。
                          </p>
                        </>
                      );
                    })()}
                  </div>

                  <div className={styles.kbImportActions}>
                    <button className={styles.saveBtn} onClick={handleSaveTool} disabled={savingTool}>
                      {savingTool ? '保存中…' : editingTool ? '更新' : '创建'}
                    </button>
                    <button className={styles.cancelBtn} onClick={() => setShowToolForm(false)}>取消</button>
                  </div>
                </div>
              )}

              {loadingTools ? (
                <p className={styles.hint}>加载 Tools 中…</p>
              ) : tools.length === 0 ? (
                <p className={styles.hint}>暂无 Tool。点击「添加 Tool」配置新的外部工具。</p>
              ) : (
                <div className={styles.kbDocList}>
                  {tools.map((tool) => (
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
                          onClick={() => handleToggleTool(tool)}
                          title={tool.enabled !== false ? '已启用' : '已禁用'}
                        >
                          {tool.enabled !== false ? '✅' : '⚪'}
                        </button>
                        <button
                          className={styles.skillEditBtn}
                          onClick={() => openEditTool(tool)}
                          title="编辑"
                        >
                          ✏️
                        </button>
                        <button
                          className={styles.kbDocDelete}
                          onClick={() => handleDeleteTool(tool.id)}
                          title="删除"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </>
            )}

            {/* ===== Tab: 知识库管理 ===== */}
            {activeTab === 'kb' && (
              <>
              <div className={styles.kbActions}>
                <button className={styles.kbImportBtn} onClick={() => setShowImport(!showImport)}>
                  📄 导入文档
                </button>
                {kbHasData && (
                  <button className={styles.kbClearBtn} onClick={handleClearKb}>
                    🗑️ 清空
                  </button>
                )}
                <button className={styles.kbRefreshBtn} onClick={loadDocs}>
                  🔄
                </button>
              </div>

              {showImport && (
                <div className={styles.kbImportForm}>
                  <div className={styles.kbModeTabs}>
                    <button
                      className={`${styles.kbModeTab} ${importMode === 'file' ? styles.kbModeActive : ''}`}
                      onClick={() => setImportMode('file')}
                    >
                      📁 文件导入
                    </button>
                    <button
                      className={`${styles.kbModeTab} ${importMode === 'text' ? styles.kbModeActive : ''}`}
                      onClick={() => setImportMode('text')}
                    >
                      ✏️ 文本粘贴
                    </button>
                  </div>

                  {importMode === 'file' ? (
                    <>
                      <label className={styles.kbFileLabel}>
                        <span className={styles.kbFileDrop}>
                          {importFiles.length > 0
                            ? importFiles.map((f) => f.name).join(', ')
                            : '点击选择文件（支持 .txt .md .json .csv 等文本文件）'}
                        </span>
                        <input
                          type="file"
                          multiple
                          accept=".txt,.md,.json,.csv,.log,.xml,.yaml,.yml,.html,.htm,.js,.ts,.py,.java,.c,.cpp,.go,.rs,.toml,.ini,.cfg,.conf,.sh,.bat"
                          className={styles.kbFileInput}
                          onChange={(e) => setImportFiles(Array.from(e.target.files || []))}
                        />
                      </label>
                      {importFiles.length > 0 && (
                        <p className={styles.hint}>
                          已选择 {importFiles.length} 个文件，共 {(importFiles.reduce((s, f) => s + f.size, 0) / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <label className={styles.field}>
                        <span>标题</span>
                        <input
                          value={importTitle}
                          onChange={(e) => setImportTitle(e.target.value)}
                          placeholder="文档标题"
                          className={styles.select}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>内容</span>
                        <textarea
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
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
                      onClick={handleImport}
                      disabled={importing || (importMode === 'text' ? !importText.trim() : importFiles.length === 0)}
                    >
                      {importing ? '导入中…' : '导入'}
                    </button>
                    <button className={styles.cancelBtn} onClick={() => { setShowImport(false); setImportFiles([]); }}>取消</button>
                  </div>
                </div>
              )}

              {loadingDocs ? (
                <p className={styles.hint}>加载文档中…</p>
              ) : docs.length === 0 ? (
                <p className={styles.hint}>暂无文档。点击「导入文档」添加知识。</p>
              ) : (
                <div className={styles.kbDocList}>
                  {docs.map((doc) => (
                    <div key={doc.docId} className={styles.kbDocItem}>
                      <div className={styles.kbDocInfo}>
                        <span className={styles.kbDocTitle}>{doc.title}</span>
                        <span className={styles.kbDocChunks}>{doc.chunkCount} 片段</span>
                      </div>
                      <button
                        className={styles.kbDocDelete}
                        onClick={() => handleDeleteDoc(doc.docId)}
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

            </div>{/* end tabPanel */}

            <div className={styles.footer}>
              {toast && <span className={styles.toast}>{toast}</span>}
              <button className={styles.cancelBtn} onClick={onClose}>取消</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
