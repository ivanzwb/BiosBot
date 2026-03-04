import { getDb } from './sqlite.client';
import { runMigrations } from './migrate';
import { defaultAgentModelMapping } from '../../config/agents.config';
import { nowISO } from '../../utils/uuid';

/**
 * 导入种子数据 — 仅在对应 key 不存在时插入，不会覆盖已有配置。
 * 同时清理旧版硬编码模型（对象格式 { provider, model }）。
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

  insertConfig.run(
    'models',
    JSON.stringify([]),
    'system',
    nowISO()
  );

  // 清理旧格式数据：将 { provider, model } 对象转为空字符串
  cleanLegacyModelObjects(db);
}

/**
 * 将 agent_model_mapping 中残留的旧格式对象 { provider, model } 转为空字符串，
 * 使系统改为使用用户在「设置」页面配置的模型。
 */
function cleanLegacyModelObjects(db: ReturnType<typeof getDb>): void {
  const row = db.prepare(`SELECT value FROM configs WHERE key = 'agent_model_mapping'`).get() as
    | { value: string }
    | undefined;
  if (!row) return;

  try {
    const mapping = JSON.parse(row.value);
    let changed = false;

    // defaultModel 可能是旧格式对象
    if (mapping.defaultModel && typeof mapping.defaultModel === 'object') {
      mapping.defaultModel = '';
      changed = true;
    }

    // 各 agent 的 model 可能是旧格式对象
    if (mapping.agents && typeof mapping.agents === 'object') {
      for (const cfg of Object.values<any>(mapping.agents)) {
        if (cfg?.model && typeof cfg.model === 'object') {
          cfg.model = '';
          changed = true;
        }
      }
    }

    if (changed) {
      db.prepare(`UPDATE configs SET value = ?, updated_at = ? WHERE key = 'agent_model_mapping'`)
        .run(JSON.stringify(mapping), nowISO());
    }
  } catch {
    // JSON 解析失败，忽略
  }
}

// 当直接运行此脚本时执行
if (require.main === module) {
  runMigrations();
  runSeeds();
  console.log('✅ Seed data imported.');
  process.exit(0);
}
