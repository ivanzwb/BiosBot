import { useEffect, useState, useCallback } from 'react';
import * as api from '../services/api';
import styles from './KnowledgePage.module.css';

interface AgentKB {
  agentId: string;
  agentName: string;
  hasData: boolean;
  documentCount: number;
  totalChunks: number;
}

export default function KnowledgePage() {
  const [agentKBs, setAgentKBs] = useState<AgentKB[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [docs, setDocs] = useState<api.DocumentSummary[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [toast, setToast] = useState('');
  const [importAgent, setImportAgent] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [importing, setImporting] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadStatus = useCallback(() => {
    api.getAllKnowledgeStatus().then(setAgentKBs).catch(console.error);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleExpand = async (agentId: string) => {
    if (expandedAgent === agentId) {
      setExpandedAgent(null);
      setDocs([]);
      return;
    }
    setExpandedAgent(agentId);
    setLoadingDocs(true);
    try {
      const d = await api.listKnowledgeDocs(agentId);
      setDocs(d);
    } catch {
      setDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleDeleteDoc = async (agentId: string, docId: string) => {
    if (!confirm('确认删除此文档？')) return;
    try {
      await api.deleteKnowledgeDoc(agentId, docId);
      setDocs((prev) => prev.filter((d) => d.docId !== docId));
      showToast('文档已删除');
      loadStatus();
    } catch (err) {
      showToast(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleClear = async (agentId: string) => {
    if (!confirm(`确认清空 ${agentId} 的全部知识库？此操作不可撤销。`)) return;
    try {
      await api.clearKnowledge(agentId);
      showToast('知识库已清空');
      setDocs([]);
      loadStatus();
    } catch (err) {
      showToast(`清空失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleImport = async () => {
    if (!importAgent || !importText.trim()) return;
    setImporting(true);
    try {
      const docId = `manual_${Date.now()}`;
      await api.ingestDocuments(importAgent, [{
        id: docId,
        title: importTitle || '手动导入',
        content: importText,
      }]);
      showToast('文档已提交导入，正在向量化…');
      setImportAgent(null);
      setImportText('');
      setImportTitle('');
      setTimeout(loadStatus, 3000);
    } catch (err) {
      showToast(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>知识库管理</h1>
        <button className={styles.refreshBtn} onClick={loadStatus}>🔄 刷新</button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {agentKBs.length === 0 && (
        <p className={styles.empty}>暂无已注册的 Agent。</p>
      )}

      <div className={styles.list}>
        {agentKBs.map((kb) => (
          <div key={kb.agentId} className={styles.agentCard}>
            <div className={styles.agentHeader} onClick={() => handleExpand(kb.agentId)}>
              <div className={styles.agentInfo}>
                <span className={styles.agentName}>{kb.agentName}</span>
                <span className={styles.agentId}>{kb.agentId}</span>
              </div>
              <div className={styles.agentStats}>
                <span className={styles.stat}>
                  {kb.documentCount} 文档
                </span>
                <span className={styles.stat}>
                  {kb.totalChunks} 片段
                </span>
                <span className={`${styles.badge} ${kb.hasData ? styles.hasData : styles.noData}`}>
                  {kb.hasData ? '有数据' : '空'}
                </span>
                <span className={styles.expandIcon}>
                  {expandedAgent === kb.agentId ? '▼' : '▶'}
                </span>
              </div>
            </div>

            {expandedAgent === kb.agentId && (
              <div className={styles.agentBody}>
                <div className={styles.bodyActions}>
                  <button
                    className={styles.importBtn}
                    onClick={(e) => { e.stopPropagation(); setImportAgent(kb.agentId); }}
                  >
                    📄 导入文档
                  </button>
                  {kb.hasData && (
                    <button
                      className={styles.clearBtn}
                      onClick={(e) => { e.stopPropagation(); handleClear(kb.agentId); }}
                    >
                      🗑️ 清空
                    </button>
                  )}
                </div>

                {loadingDocs ? (
                  <p className={styles.loadingText}>加载中…</p>
                ) : docs.length === 0 ? (
                  <p className={styles.emptyDocs}>暂无文档</p>
                ) : (
                  <div className={styles.docList}>
                    {docs.map((doc) => (
                      <div key={doc.docId} className={styles.docItem}>
                        <div className={styles.docInfo}>
                          <span className={styles.docTitle}>{doc.title}</span>
                          <span className={styles.docChunks}>{doc.chunkCount} 片段</span>
                        </div>
                        <button
                          className={styles.docDelete}
                          onClick={() => handleDeleteDoc(kb.agentId, doc.docId)}
                          title="删除文档"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 导入文档弹窗 */}
      {importAgent && (
        <div className={styles.overlay} onClick={() => setImportAgent(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>导入文档到 {importAgent}</h2>
              <button className={styles.closeBtn} onClick={() => setImportAgent(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.field}>
                <span>标题</span>
                <input
                  className={styles.input}
                  value={importTitle}
                  onChange={(e) => setImportTitle(e.target.value)}
                  placeholder="文档标题"
                />
              </label>
              <label className={styles.field}>
                <span>内容</span>
                <textarea
                  className={styles.textarea}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="粘贴文档内容…"
                  rows={12}
                />
              </label>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setImportAgent(null)}>取消</button>
              <button
                className={styles.saveBtn}
                onClick={handleImport}
                disabled={importing || !importText.trim()}
              >
                {importing ? '导入中…' : '导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
