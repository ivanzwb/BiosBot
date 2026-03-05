import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import * as api from '../services/api';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const [conversations, setConversations] = useState<api.Conversation[]>([]);
  const navigate = useNavigate();
  const { conversationId } = useParams();

  const load = () => {
    api.listConversations().then(setConversations).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  // 监听对话更新事件（如标题自动生成后刷新列表）
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('conversation-updated', handler);
    return () => window.removeEventListener('conversation-updated', handler);
  }, []);

  const handleNew = async () => {
    try {
      const c = await api.createConversation();
      setConversations((prev) => [c, ...prev]);
      navigate(`/chat/${c.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('确认删除此对话？')) return;
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) navigate('/chat');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>🐬 DolphinBot</div>

      <button className={styles.newChat} onClick={handleNew}>
        + 新对话
      </button>

      <nav className={styles.conversations}>
        {conversations.map((c) => (
          <NavLink
            key={c.id}
            to={`/chat/${c.id}`}
            className={({ isActive }) =>
              `${styles.item} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.title}>{c.title || '新对话'}</span>
            <button
              className={styles.delete}
              onClick={(e) => handleDelete(e, c.id)}
              title="删除"
            >
              ×
            </button>
          </NavLink>
        ))}
      </nav>

      <div className={styles.navLinks}>
        <NavLink to="/agents" className={({ isActive }) => isActive ? styles.navActive : ''}>
          🤖 Agents
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => isActive ? styles.navActive : ''}>
          ⚙️ 设置
        </NavLink>
      </div>
    </aside>
  );
}
