import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '../services/api';
import { onWsEventType } from '../services/ws';
import ChatInput from '../components/ChatInput';
import MessageBubble from '../components/MessageBubble';
import styles from './ChatPage.module.css';

/** 轮询任务状态，直到完成或失败 (fallback) */
async function pollTask(taskId: string, interval = 1000, maxAttempts = 120): Promise<api.Task> {
  for (let i = 0; i < maxAttempts; i++) {
    const task = await api.getTask(taskId);
    if (task.status === 'succeeded' || task.status === 'failed') return task;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error('任务超时');
}

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<api.Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 加载历史消息
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    api.listMessages(conversationId).then(setMessages).catch(console.error);
  }, [conversationId]);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;

    let cid = conversationId;

    // 如果没有活跃对话，先创建一个
    if (!cid) {
      try {
        const c = await api.createConversation(text.slice(0, 30));
        cid = c.id;
        navigate(`/chat/${cid}`, { replace: true });
      } catch (err) {
        console.error(err);
        return;
      }
    }

    // 乐观添加用户消息
    const userMsg: api.Message = {
      id: `temp-${Date.now()}`,
      conversation_id: cid,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // 调用 Agent
      const result = await api.invokeAgent(cid, text);

      // 尝试 WebSocket 实时推送，同时启动 polling 做 fallback
      const wsPromise = new Promise<api.Task>((resolve) => {
        const unsub = onWsEventType('task:update', (payload: { taskId: string; status: string; result?: string; error?: string }) => {
          if (payload.taskId === result.taskId && (payload.status === 'succeeded' || payload.status === 'failed')) {
            unsub();
            resolve({ id: result.taskId, status: payload.status as 'succeeded' | 'failed', result: payload.result, error: payload.error } as api.Task);
          }
        });
        // 超时 120 秒后 fallback 到 polling 结果
        setTimeout(() => { unsub(); }, 120_000);
      });

      const task = await Promise.race([wsPromise, pollTask(result.taskId)]);

      if (task.status === 'succeeded') {
        // 重新加载消息列表（后端已保存 assistant 回复）
        const msgs = await api.listMessages(cid);
        setMessages(msgs);

        // 首次回复后自动生成对话标题
        api.generateTitle(cid).then(({ title }) => {
          if (title && title !== '新对话') {
            // 通知 Sidebar 刷新对话列表
            window.dispatchEvent(new CustomEvent('conversation-updated'));
          }
        }).catch(() => { /* 标题生成失败不影响使用 */ });
      } else {
        // 任务失败 — 显示错误消息
        const errMsg: api.Message = {
          id: `err-${Date.now()}`,
          conversation_id: cid,
          role: 'assistant',
          content: `⚠️ ${task.error || '请求处理失败，请重试。'}`,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } catch (err) {
      const errMsg: api.Message = {
        id: `err-${Date.now()}`,
        conversation_id: cid,
        role: 'assistant',
        content: `⚠️ 请求失败：${err instanceof Error ? err.message : String(err)}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, navigate]);

  // 空状态
  if (!conversationId && messages.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <h2>🐬 DolphinBot</h2>
          <p>你的多智能体助手。输入问题开始对话。</p>
        </div>
        <ChatInput onSend={handleSend} disabled={loading} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.messages}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} conversationId={conversationId} />
        ))}
        {loading && (
          <div className={styles.thinking}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}
