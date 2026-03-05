import { useEffect, useState } from 'react';
import * as api from '../services/api';
import AgentConfigModal from '../components/AgentConfigModal';
import styles from './AgentsPage.module.css';

const emptyDraft = () => ({
  id: '',
  name: '',
  description: '',
  labels: '',
  defaultTemperature: 0.5,
  systemPrompt: '',
});

export default function AgentsPage() {
  const [agents, setAgents] = useState<api.AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<api.AgentInfo | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');

  const load = () => {
    api.listAgents().then(setAgents).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleCreate = async () => {
    if (!draft.id.trim() || !draft.name.trim()) {
      flash('❌ ID 和名称不能为空');
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(draft.id.trim())) {
      flash('❌ ID 只能包含小写字母、数字和连字符，且以字母或数字开头');
      return;
    }
    setCreating(true);
    try {
      const labels = draft.labels
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      await api.createAgent({
        id: draft.id.trim(),
        name: draft.name.trim(),
        description: draft.description.trim(),
        labels,
        defaultTemperature: draft.defaultTemperature,
        systemPrompt: draft.systemPrompt.trim(),
      });
      flash('✅ Agent 已创建');
      setShowCreate(false);
      setDraft(emptyDraft());
      load();
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation();
    if (!confirm(`确认删除 Agent "${agentId}"？`)) return;
    try {
      await api.deleteAgent(agentId);
      flash('已删除');
      load();
    } catch (err) {
      flash(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.header}>
        <h1>Agents</h1>
        <div className={styles.headerActions}>
          <button className={styles.addBtn} onClick={() => setShowCreate(true)} disabled={showCreate}>
            + 添加 Agent
          </button>
        </div>
      </div>

      {/* ===== 创建表单 ===== */}
      {showCreate && (
        <div className={styles.createForm}>
          <h3>新建 Domain Agent</h3>
          <label className={styles.field}>
            <span>Agent ID *</span>
            <input
              value={draft.id}
              onChange={(e) => setDraft({ ...draft, id: e.target.value })}
              placeholder="如 travel-agent（小写字母、数字、连字符）"
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <span>名称 *</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Agent 显示名称"
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <span>描述</span>
            <input
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Agent 的功能描述"
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <span>标签</span>
            <input
              value={draft.labels}
              onChange={(e) => setDraft({ ...draft, labels: e.target.value })}
              placeholder="用逗号分隔，如：推荐, 解析, 分析"
              className={styles.input}
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
                value={draft.defaultTemperature}
                onChange={(e) => setDraft({ ...draft, defaultTemperature: Number(e.target.value) })}
                className={styles.tempSlider}
              />
              <span className={styles.tempValue}>{draft.defaultTemperature}</span>
            </div>
          </label>
          <label className={styles.field}>
            <span>System Prompt</span>
            <textarea
              value={draft.systemPrompt}
              onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
              placeholder="定义 Agent 的人设和能力范围…（留空将自动生成）"
              rows={4}
              className={styles.textarea}
            />
          </label>
          <div className={styles.formActions}>
            <button className={styles.saveBtn} onClick={handleCreate} disabled={creating}>
              {creating ? '创建中…' : '创建'}
            </button>
            <button className={styles.cancelBtn} onClick={() => { setShowCreate(false); setDraft(emptyDraft()); }}>
              取消
            </button>
          </div>
        </div>
      )}

      <div className={styles.grid}>
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={styles.card}
            onClick={() => setSelectedAgent(agent)}
            role="button"
            tabIndex={0}
          >
            <div className={styles.cardHeader}>
              <span className={styles.name}>{agent.name}</span>
              <div className={styles.cardActions}>
                <span className={`${styles.badge} ${agent.enabled ? styles.enabled : styles.disabled}`}>
                  {agent.enabled ? '已启用' : '已禁用'}
                </span>
                <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDelete(e, agent.id)}
                    title="删除"
                  >
                    ×
                  </button>
              </div>
            </div>
            <p className={styles.desc}>{agent.description}</p>
            {agent.labels && agent.labels.length > 0 && (
              <div className={styles.labels}>
                {agent.labels.map((l) => (
                  <span key={l} className={styles.label}>{l}</span>
                ))}
              </div>
            )}
            <div className={styles.cardFooter}>
              {agent.model && (
                <span className={styles.model}>
                  {typeof agent.model === 'string' ? agent.model : ((agent.model as any).name || String(agent.model))}
                </span>
              )}
              {agent.source && (
                <span className={styles.sourceBadge}>
                  {agent.source === 'db' ? '动态' : '内置'}
                </span>
              )}
            </div>
          </div>
        ))}
        {agents.length === 0 && !showCreate && (
          <p className={styles.empty}>暂无 Agent。点击「添加 Agent」创建。</p>
        )}
      </div>

      {selectedAgent && (
        <AgentConfigModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
