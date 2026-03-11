/**
 * index.ts — 服务入口
 *
 * 启动流程：加载配置 → 数据库迁移 → 种子数据 → 注册 Agent → 启动 HTTP + WebSocket 服务
 */

import { createServer } from 'http';
import { config } from './config';
import logger from './infra/logger/logger';

// 数据库
import { runMigrations } from './infra/db/migrate';
import { runSeeds } from './infra/db/seed';

// Agent 自动发现
import { discoverAndRegisterAgents } from './agents/agent-discovery';
import { loadProxySkills } from './agents/proxy-agent';

// Express 应用
import app from './app';

// WebSocket
import { initWebSocket } from './services/ws.service';

async function bootstrap(): Promise<void> {
  logger.info('=== BiosBot 启动中 ===');

  // 1. 数据库初始化
  logger.info('Running database migrations...');
  runMigrations();

  logger.info('Running database seeds...');
  runSeeds();

  // 2. 自动发现并注册领域 Agent（同时加载各 Agent 的 Skill）
  const agents = await discoverAndRegisterAgents();
  logger.info(`Domain agents registered (${agents.length}): ${agents.map(a => a.id).join(', ')}`);

  // 3. 加载 proxy-agent 自身的 Skill
  await loadProxySkills();

  // 4. 创建 HTTP Server 并附加 WebSocket
  const server = createServer(app);
  initWebSocket(server);

  // 5. 启动服务
  const port = config.port;
  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`);
    logger.info(`WebSocket available at ws://localhost:${port}/ws`);
    logger.info(`Health check: http://localhost:${port}/api/health`);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
