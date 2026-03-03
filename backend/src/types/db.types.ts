// ============================================================
// 数据库实体类型 — 与 SQLite 表结构一一对应
// ============================================================

/** conversations 表 */
export interface ConversationRecord {
  id: string;
  title: string;
  status: 'active' | 'archived' | 'closed';
  created_at: string;
  updated_at: string;
}

/** messages 表 */
export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'agent';
  content: string;
  agent_id?: string;
  created_at: string;
}

/** agent_logs 表 */
export interface AgentLogRecord {
  id: string;
  conversation_id: string;
  agent_id: string;
  input: string;
  output: string;
  latency_ms: number;
  success_flag: number; // SQLite 用 0/1
  created_at: string;
}

/** tasks 表 */
export interface TaskRecord {
  id: string;
  conversation_id?: string;
  type: 'agent_invoke' | 'ingest' | 'maintenance';
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';
  payload: string;
  result?: string;
  progress?: number;
  error?: string;
  created_at: string;
  updated_at: string;
  last_heartbeat_at?: string;
}

/** configs 表 */
export interface ConfigRecord {
  key: string;
  value: string;
  scope: 'system' | 'agent';
  updated_at: string;
}
