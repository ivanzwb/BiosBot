import { getDb } from '../infra/db/sqlite.client';
import { AgentLogRecord } from '../types/db.types';
import { generateId, nowISO } from '../utils/uuid';

export function createAgentLog(
  conversationId: string,
  agentId: string,
  input: unknown,
  output: unknown,
  latencyMs: number,
  success: boolean
): AgentLogRecord {
  const db = getDb();
  const record: AgentLogRecord = {
    id: generateId(),
    conversation_id: conversationId,
    agent_id: agentId,
    input: JSON.stringify(input),
    output: JSON.stringify(output),
    latency_ms: latencyMs,
    success_flag: success ? 1 : 0,
    created_at: nowISO(),
  };
  db.prepare(
    `INSERT INTO agent_logs (id, conversation_id, agent_id, input, output, latency_ms, success_flag, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(record.id, record.conversation_id, record.agent_id, record.input, record.output, record.latency_ms, record.success_flag, record.created_at);
  return record;
}

export function listAgentLogs(conversationId: string): AgentLogRecord[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM agent_logs WHERE conversation_id = ? ORDER BY created_at DESC`
  ).all(conversationId) as AgentLogRecord[];
}
