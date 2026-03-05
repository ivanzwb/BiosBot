/**
 * global-tool-loader.ts — 全局 Tool 自动发现与加载
 *
 * 从全局Tools目录加载所有 Agent 都可以使用的通用 Tool。
 * 复用 tool-loader.ts 的执行逻辑，仅变更存储位置。
 *
 * 约定：
 *  - 全局 Tool 定义文件位于 <project>/global-tools/<tool-id>.json
 *  - 脚本文件存放在 <project>/global-tools/scripts/ 目录下
 *  - MCP Server 配置文件位于 <project>/global-tools/mcp-servers/<server-id>.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { DynamicStructuredTool } from '@langchain/core/tools';
import logger from '../infra/logger/logger';
import { AgentToolConfig, createToolFromConfig } from './tool-loader';
import { McpServerConfig, createMcpTools } from './mcp-client';

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

// ============================================================
// MCP Server 管理
// ============================================================

/**
 * 获取 MCP Server 配置目录
 */
export function getMcpServersDir(): string {
  return path.join(getGlobalToolsDir(), 'mcp-servers');
}

/**
 * 加载所有 MCP Server 配置
 */
export function loadMcpServerConfigs(): McpServerConfig[] {
  const mcpServersDir = getMcpServersDir();
  const configs: McpServerConfig[] = [];

  if (!fs.existsSync(mcpServersDir)) {
    return configs;
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(mcpServersDir);
  } catch (err) {
    logger.error('global-tool-loader: failed to read mcp-servers dir', { error: err });
    return configs;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;

    const filePath = path.join(mcpServersDir, entry);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const cfg: McpServerConfig = JSON.parse(raw);

      if (!cfg.id || !cfg.command) {
        logger.warn(`global-tool-loader: MCP server "${entry}" missing required fields, skipped`);
        continue;
      }

      configs.push(cfg);
      logger.debug(`global-tool-loader: loaded MCP server config "${cfg.id}"`);
    } catch (err) {
      logger.warn(`global-tool-loader: failed to load MCP server "${entry}"`, { error: err });
    }
  }

  return configs;
}

/**
 * 加载所有启用的 MCP Server 提供的工具
 * 注意：此函数是异步的，因为需要连接 MCP Server 获取工具列表
 */
export async function loadMcpTools(): Promise<DynamicStructuredTool[]> {
  const configs = loadMcpServerConfigs();
  const tools: DynamicStructuredTool[] = [];

  for (const cfg of configs) {
    if (cfg.enabled === false) {
      continue;
    }

    try {
      const mcpTools = await createMcpTools(cfg, undefined, '[MCP] ');
      tools.push(...mcpTools);
      logger.info(`global-tool-loader: loaded ${mcpTools.length} tools from MCP server "${cfg.id}"`);
    } catch (err) {
      logger.error(`global-tool-loader: failed to load tools from MCP server "${cfg.id}"`, { error: err });
    }
  }

  return tools;
}

/**
 * 加载所有全局工具（包括普通工具和 MCP 工具）
 * 注意：此函数是异步的
 */
export async function loadAllGlobalTools(): Promise<{
  configs: AgentToolConfig[];
  mcpConfigs: McpServerConfig[];
  tools: DynamicStructuredTool[];
}> {
  const { configs, tools } = loadGlobalTools();
  const mcpConfigs = loadMcpServerConfigs();
  const mcpTools = await loadMcpTools();

  return {
    configs,
    mcpConfigs,
    tools: [...tools, ...mcpTools],
  };
}
