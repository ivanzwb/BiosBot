import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '../services/api';
import { onWsEventType, connectWs } from '../services/ws';
import ChatInput from '../components/ChatInput';
import MessageBubble from '../components/MessageBubble';
import ExecutionStepsIndicator from '../components/ExecutionStepsIndicator';
import { ExecutionStep } from '../types/execution-step';
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

/** 更新或添加执行步骤（根据 stepType 和 agentId 匹配） */
function updateOrAddStep(steps: ExecutionStep[], newStep: ExecutionStep): ExecutionStep[] {
  // 对于 Agent 相关步骤，查找同一 Agent 的步骤进行更新
  if (newStep.stepType === 'agent_start' || newStep.stepType === 'agent_end') {
    const idx = steps.findIndex(
      (s) => (s.stepType === 'agent_start' || s.stepType === 'agent_end') && s.agentId === newStep.agentId
    );
    if (idx >= 0) {
      const updated = [...steps];
      updated[idx] = newStep;
      return updated;
    }
  } else {
    // 对于其他步骤，查找同类型步骤进行更新
    const idx = steps.findIndex((s) => s.stepType === newStep.stepType);
    if (idx >= 0) {
      const updated = [...steps];
      updated[idx] = newStep;
      return updated;
    }
  }
  // 未找到则添加
  return [...steps, newStep];
}

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<api.Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 页面加载时提前连接 WebSocket
  useEffect(() => {
    connectWs();
  }, []);

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
    setExecutionSteps([]); // 清空之前的步骤

    let stepUnsub: (() => void) | null = null;
    let currentTaskId: string | null = null;
    const pendingSteps: ExecutionStep[] = []; // 缓存在拿到 taskId 前收到的步骤

    // 提前注册步骤监听（通过 conversationId 过滤，因为 taskId 还没拿到）
    stepUnsub = onWsEventType('step:update', (payload: { conversationId?: string; taskId: string; step: ExecutionStep }) => {
      // 如果已经拿到 taskId，精确匹配
      if (currentTaskId && payload.taskId === currentTaskId) {
        setExecutionSteps((prev) => updateOrAddStep(prev, payload.step));
      } else if (!currentTaskId && payload.conversationId === cid) {
        // 还没拿到 taskId，但 conversationId 匹配，先缓存
        pendingSteps.push(payload.step);
        setExecutionSteps((prev) => updateOrAddStep(prev, payload.step));
      }
    });

    try {
      // 调用 Agent
      const result = await api.invokeAgent(cid, text);
      currentTaskId = result.taskId;

      // 处理在拿到 taskId 之前缓存的步骤（如果有漏掉的）
      if (pendingSteps.length > 0) {
        setExecutionSteps((prev) => {
          let updated = prev;
          for (const step of pendingSteps) {
            updated = updateOrAddStep(updated, step);
          }
          return updated;
        });
      }

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
      stepUnsub?.();
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
        {loading && executionSteps.length === 0 && (
          <div className={styles.thinking}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {loading && executionSteps.length > 0 && (
        <ExecutionStepsIndicator steps={executionSteps} />
      )}
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}
