import { getDb } from './sqlite.client';
import { runMigrations } from './migrate';
import { defaultAgentModelMapping } from '../../config/agents.config';
import { nowISO } from '../../utils/uuid';

/**
 * 导入种子数据 — 仅在对应 key 不存在时插入，不会覆盖已有配置。
 */
export function runSeeds(): void {
  const db = getDb();

  const insertConfig = db.prepare(`
    INSERT OR IGNORE INTO configs (key, value, scope, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  insertConfig.run(
    'agent_model_mapping',
    JSON.stringify(defaultAgentModelMapping),
    'system',
    nowISO()
  );

  insertConfig.run(
    'default_model',
    JSON.stringify(defaultAgentModelMapping.defaultModel),
    'system',
    nowISO()
  );
}

// 当直接运行此脚本时执行
if (require.main === module) {
  runMigrations();
  runSeeds();
  console.log('✅ Seed data imported.');
  process.exit(0);
}
