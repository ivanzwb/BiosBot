import { getDb } from '../infra/db/sqlite.client';
import { ConfigRecord } from '../types/db.types';
import { nowISO } from '../utils/uuid';

export function getConfig(key: string): ConfigRecord | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM configs WHERE key = ?`).get(key) as ConfigRecord | undefined;
}

export function listConfigs(): ConfigRecord[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM configs ORDER BY key`).all() as ConfigRecord[];
}

export function upsertConfig(key: string, value: string, scope: ConfigRecord['scope'] = 'system'): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO configs (key, value, scope, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, scope = excluded.scope, updated_at = excluded.updated_at`
  ).run(key, value, scope, nowISO());
}

/** 解析 configs 表中的 JSON value，解析失败返回 null */
export function getConfigJSON<T = unknown>(key: string): T | null {
  const row = getConfig(key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}
