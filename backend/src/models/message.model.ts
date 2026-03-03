import { getDb } from '../infra/db/sqlite.client';
import { MessageRecord } from '../types/db.types';
import { generateId, nowISO } from '../utils/uuid';

export function createMessage(
  conversationId: string,
  role: MessageRecord['role'],
  content: string,
  agentId?: string
): MessageRecord {
  const db = getDb();
  const record: MessageRecord = {
    id: generateId(),
    conversation_id: conversationId,
    role,
    content,
    agent_id: agentId,
    created_at: nowISO(),
  };
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, agent_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(record.id, record.conversation_id, record.role, record.content, record.agent_id ?? null, record.created_at);
  return record;
}

export function listMessages(conversationId: string): MessageRecord[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`
  ).all(conversationId) as MessageRecord[];
}

export function deleteMessagesByConversation(conversationId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM messages WHERE conversation_id = ?`).run(conversationId);
}
