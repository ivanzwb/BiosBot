import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'debug',
  sqliteDbPath: process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../../database/cloudbrain.db'),

  /**
   * Agent 发现目录列表（逗号分隔的绝对或相对路径）。
   * 相对路径基于项目根目录（backend/）解析。
   * 默认值：内置 agents/ 目录（src/agents）。
   */
  agentDirs: (process.env.AGENT_DIRS || '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => (path.isAbsolute(d) ? d : path.resolve(__dirname, '..', d))),
};
