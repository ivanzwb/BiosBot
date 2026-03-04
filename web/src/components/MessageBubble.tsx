import { useState } from 'react';
import type { Message } from '../services/api';
import * as api from '../services/api';
import styles from './MessageBubble.module.css';

interface Props {
  message: Message;
  conversationId?: string;
}

export default function MessageBubble({ message, conversationId }: Props) {
  const isUser = message.role === 'user';
  const [showKbMenu, setShowKbMenu] = useState(false);
  const [agents, setAgents] = useState<api.AgentInfo[]>([]);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState('');

  const handleKbClick = async () => {
    if (showKbMenu) { setShowKbMenu(false); return; }
    try {
      const list = await api.listAgents();
      setAgents(list);
      setShowKbMenu(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleImportTo = async (agentId: string) => {
    if (!conversationId) return;
    setImporting(true);
    try {
      await api.ingestConversation(agentId, conversationId, [message.id]);
      setToast('已提交导入');
      setTimeout(() => setToast(''), 2500);
    } catch (err) {
      setToast(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setToast(''), 3000);
    } finally {
      setImporting(false);
      setShowKbMenu(false);
    }
  };

  return (
    <div className={`${styles.row} ${isUser ? styles.userRow : styles.assistantRow}`}>
      <div className={`${styles.avatar} ${isUser ? styles.userAvatar : styles.assistantAvatar}`}>
        {isUser ? '🙂' : '🤖'}
      </div>
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
        <div className={styles.content}>{message.content}</div>
        <div className={styles.footer}>
          <span className={styles.time}>
            {new Date(message.created_at).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {!isUser && conversationId && (
            <div className={styles.kbWrapper}>
              <button
                className={styles.kbBtn}
                onClick={handleKbClick}
                title="导入到知识库"
                disabled={importing}
              >
                📥
              </button>
              {showKbMenu && (
                <div className={styles.kbMenu}>
                  <div className={styles.kbMenuTitle}>导入到...</div>
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      className={styles.kbMenuItem}
                      onClick={() => handleImportTo(a.id)}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {toast && <div className={styles.kbToast}>{toast}</div>}
      </div>
    </div>
  );
}
