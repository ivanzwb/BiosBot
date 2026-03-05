/**
 * global-tool-loader.ts — 全局 Tool 自动发现与加载
 *
 * 从全局Tools目录加载所有 Agent 都可以使用的通用 Tool。
 * 复用 tool-loader.ts 的执行逻辑，仅变更存储位置。
 *
 * 约定：
 *  - 全局 Tool 定义文件位于 <project>/global-tools/<tool-id>.json
 *  - 脚本文件存放在 <project>/global-tools/scripts/ 目录下
 */

import * as fs from 'fs';
import * as path from 'path';
import { DynamicStructuredTool } from '@langchain/core/tools';
import logger from '../infra/logger/logger';
import { AgentToolConfig, createToolFromConfig } from './tool-loader';

// ============================================================
// 全局Tools目录路径
// ============================================================

/**
 * 获取全局Tools目录的绝对路径。
 * 默认位于 backend/global-tools/
 */
export function getGlobalToolsDir(): string {
  return path.join(__dirname, '../../global-tools');
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 加载全局Tools目录中的所有 Tool 配置，
 * 并创建对应的 DynamicStructuredTool 实例。
 *
 * @returns { configs: 原始配置, tools: LangChain 工具实例 }
 */
export function loadGlobalTools(): {
  configs: AgentToolConfig[];
  tools: DynamicStructuredTool[];
} {
  const globalToolsDir = getGlobalToolsDir();
  const configs: AgentToolConfig[] = [];
  const tools: DynamicStructuredTool[] = [];

  if (!fs.existsSync(globalToolsDir)) {
    // 自动创建全局Tools目录
    try {
      fs.mkdirSync(globalToolsDir, { recursive: true });
      logger.info('global-tool-loader: created global-tools directory');
    } catch (err) {
      logger.error('global-tool-loader: failed to create global-tools directory', { error: err });
    }
    return { configs, tools };
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(globalToolsDir);
  } catch (err) {
    logger.error(`global-tool-loader: failed to read global-tools dir`, { error: err });
    return { configs, tools };
  }

  const scriptsDir = path.join(globalToolsDir, 'scripts');

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;

    const filePath = path.join(globalToolsDir, entry);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const cfg: AgentToolConfig = JSON.parse(raw);

      if (!cfg.id || !cfg.name || !cfg.description) {
        logger.warn(`global-tool-loader: "${entry}" missing required fields, skipped`);
        continue;
      }

      configs.push(cfg);

      // 跳过禁用的 Tool
      if (cfg.enabled === false) {
        continue;
      }

      const tool = createToolFromConfig(cfg, scriptsDir, '[全局] ', 'global-tool-loader');
      tools.push(tool);
      logger.debug(`global-tool-loader: loaded global tool "${cfg.id}"`);
    } catch (err) {
      logger.warn(`global-tool-loader: failed to load "${entry}"`, { error: err });
    }
  }

  return { configs, tools };
}

/**
 * 仅加载全局 Tool 配置（不创建 DynamicStructuredTool 实例），用于 API 列表展示。
 */
export function loadGlobalToolConfigs(): AgentToolConfig[] {
  return loadGlobalTools().configs;
}
