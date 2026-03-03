import { getDb } from '../infra/db/sqlite.client';
import { TaskRecord } from '../types/db.types';
import { generateId, nowISO } from '../utils/uuid';

export function createTask(
  type: TaskRecord['type'],
  payload: unknown,
  conversationId?: string
): TaskRecord {
  const db = getDb();
  const now = nowISO();
  const record: TaskRecord = {
    id: generateId(),
    conversation_id: conversationId,
    type,
    status: 'pending',
    payload: JSON.stringify(payload),
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO tasks (id, conversation_id, type, status, payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(record.id, record.conversation_id ?? null, record.type, record.status, record.payload, record.created_at, record.updated_at);
  return record;
}

export function getTask(id: string): TaskRecord | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRecord | undefined;
}

export function listTasks(status?: TaskRecord['status']): TaskRecord[] {
  const db = getDb();
  if (status) {
    return db.prepare(`SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC`).all(status) as TaskRecord[];
  }
  return db.prepare(`SELECT * FROM tasks ORDER BY created_at DESC`).all() as TaskRecord[];
}

export function updateTask(id: string, fields: Partial<Pick<TaskRecord, 'status' | 'result' | 'progress' | 'error'>>): void {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  if (fields.status !== undefined) { sets.push('status = ?'); values.push(fields.status); }
  if (fields.result !== undefined) { sets.push('result = ?'); values.push(fields.result); }
  if (fields.progress !== undefined) { sets.push('progress = ?'); values.push(fields.progress); }
  if (fields.error !== undefined) { sets.push('error = ?'); values.push(fields.error); }
  sets.push('updated_at = ?');
  values.push(nowISO());
  values.push(id);
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function heartbeatTask(id: string): void {
  const db = getDb();
  db.prepare(`UPDATE tasks SET last_heartbeat_at = ?, updated_at = ? WHERE id = ?`).run(nowISO(), nowISO(), id);
}
