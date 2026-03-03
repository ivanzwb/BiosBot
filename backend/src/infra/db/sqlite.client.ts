import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../../config';

let db: Database.Database | null = null;

/** 获取 SQLite 单例连接 */
export function getDb(): Database.Database {
  if (!db) {
    // 确保目录存在
    const dir = path.dirname(config.sqliteDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(config.sqliteDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/** 关闭数据库连接 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
