import { getDb } from './sqlite.client';

/**
 * 执行数据库迁移 — 创建所有核心表（幂等）。
 */
export function runMigrations(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived','closed')),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL CHECK(role IN ('user','assistant','system','agent')),
      content         TEXT NOT NULL DEFAULT '',
      agent_id        TEXT,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS agent_logs (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      agent_id        TEXT NOT NULL,
      input           TEXT NOT NULL DEFAULT '{}',
      output          TEXT NOT NULL DEFAULT '{}',
      latency_ms      INTEGER NOT NULL DEFAULT 0,
      success_flag    INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_agent_logs_conv ON agent_logs(conversation_id);

    CREATE TABLE IF NOT EXISTS tasks (
      id                TEXT PRIMARY KEY,
      conversation_id   TEXT,
      type              TEXT NOT NULL CHECK(type IN ('agent_invoke','ingest','maintenance')),
      status            TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','succeeded','failed','canceled')),
      payload           TEXT NOT NULL DEFAULT '{}',
      result            TEXT,
      progress          INTEGER,
      error             TEXT,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      last_heartbeat_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

    CREATE TABLE IF NOT EXISTS configs (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '{}',
      scope      TEXT NOT NULL DEFAULT 'system' CHECK(scope IN ('system','agent')),
      updated_at TEXT NOT NULL
    );
  `);
}

// 当直接运行此脚本时执行迁移
if (require.main === module) {
  runMigrations();
  console.log('✅ Database migrations completed.');
  process.exit(0);
}
