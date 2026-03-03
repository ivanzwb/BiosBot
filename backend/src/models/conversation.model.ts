import { getDb } from '../infra/db/sqlite.client';
import { ConversationRecord } from '../types/db.types';
import { generateId, nowISO } from '../utils/uuid';

export function createConversation(title?: string): ConversationRecord {
  const db = getDb();
  const now = nowISO();
  const record: ConversationRecord = {
    id: generateId(),
    title: title || '新对话',
    status: 'active',
    created_at: now,
    updated_at: now,
  };
  db.prepare(`INSERT INTO conversations (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(record.id, record.title, record.status, record.created_at, record.updated_at);
  return record;
}

export function listConversations(): ConversationRecord[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM conversations ORDER BY updated_at DESC`).all() as ConversationRecord[];
}

export function getConversation(id: string): ConversationRecord | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id) as ConversationRecord | undefined;
}

export function updateConversation(id: string, fields: Partial<Pick<ConversationRecord, 'title' | 'status'>>): void {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  if (fields.title !== undefined) { sets.push('title = ?'); values.push(fields.title); }
  if (fields.status !== undefined) { sets.push('status = ?'); values.push(fields.status); }
  sets.push('updated_at = ?');
  values.push(nowISO());
  values.push(id);
  db.prepare(`UPDATE conversations SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteConversation(id: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM conversations WHERE id = ?`).run(id);
}
