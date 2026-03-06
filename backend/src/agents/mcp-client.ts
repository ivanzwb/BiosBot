/**
 * mcp-client.ts — MCP (Model Context Protocol) 客户端管理
 *
 * 基于 @langchain/mcp-adapters 管理 MCP Server 连接与工具创建。
 * 支持本地 MCP Server（stdio）和远程 MCP Server（SSE/HTTP）。
 *
 * 参考: https://modelcontextprotocol.io/
 */

import * as path from 'path';
import { z } from 'zod';
import { MultiServerMCPClient, type Connection } from '@langchain/mcp-adapters';
import { DynamicStructuredTool } from '@langchain/core/tools';
import logger from '../infra/logger/logger';

// ============================================================
// 类型定义
// ============================================================

export type McpServerType = 'local' | 'remote';

export interface McpServerConfig {
  /** MCP Server 唯一标识 */
  id: string;
  /** 服务器类型：local（本地进程）或 remote（远程 SSE/HTTP） */
  type?: McpServerType;
  /** 是否启用 */
  enabled?: boolean;

  // === 本地 MCP Server 配置 (type = 'local') ===
  /** 启动命令 */
  command?: string;
  /** 命令参数 */
  args?: string[];
  /** 环境变量 */
  env?: Record<string, string>;

  // === 远程 MCP Server 配置 (type = 'remote') ===
  /** 远程服务器 URL (SSE endpoint) */
  url?: string;
  /** 自定义请求头（如认证 token） */
  headers?: Record<string, string>;
}

// ============================================================
// MultiServerMCPClient 实例缓存（按 serverId 管理）
// ============================================================

const mcpClientInstances = new Map<string, MultiServerMCPClient>();

/**
 * 将 McpServerConfig 转换为 @langchain/mcp-adapters 的 Connection 格式
 */
function toAdapterConnection(config: McpServerConfig): Connection {
  const serverType = config.type || 'local';
  if (serverType === 'remote') {
    if (!config.url) {
      throw new Error(`MCP server "${config.id}" is remote but missing url`);
    }
    return {
      transport: 'sse' as const,
      url: config.url,
      headers: config.headers,
    };
  }
  if (!config.command) {
    throw new Error(`MCP server "${config.id}" is local but missing command`);
  }
  return {
    transport: 'stdio' as const,
    command: config.command,
    args: config.args || [],
    env: config.env,
  };
}

/**
 * 获取或创建指定 MCP Server 的 MultiServerMCPClient 实例
 */
async function getOrCreateClient(config: McpServerConfig): Promise<MultiServerMCPClient> {
  const existing = mcpClientInstances.get(config.id);
  if (existing) return existing;

  logger.info(`mcp-client: connecting to MCP server "${config.id}"`, {
    type: config.type || 'local',
    command: config.command,
    url: config.url,
  });

  const client = new MultiServerMCPClient({
    throwOnLoadError: true,
    prefixToolNameWithServerName: false,
    mcpServers: {
      [config.id]: toAdapterConnection(config),
    },
  });

  mcpClientInstances.set(config.id, client);
  logger.info(`mcp-client: connected to MCP server "${config.id}"`);
  return client;
}

/**
 * 关闭指定 MCP 客户端连接
 */
export async function closeMcpClient(serverId: string): Promise<void> {
  const instance = mcpClientInstances.get(serverId);
  if (instance) {
    try {
      await instance.close();
      mcpClientInstances.delete(serverId);
      logger.info(`mcp-client: disconnected from MCP server "${serverId}"`);
    } catch (err) {
      logger.error(`mcp-client: error closing connection to "${serverId}"`, { error: err });
    }
  }
}

/**
 * 关闭所有 MCP 客户端连接
 */
export async function closeAllMcpClients(): Promise<void> {
  for (const serverId of mcpClientInstances.keys()) {
    await closeMcpClient(serverId);
  }
}

// ============================================================
// 文件路径自动解析（第一层保护：后端兜底）
// ============================================================

/** 常见的路径参数名 */
const PATH_ARG_NAMES = ['path', 'directory', 'source', 'destination'];

/**
 * 从 MCP Server config 的 args 中提取允许的目录列表。
 * filesystem MCP Server 的 args 格式通常为: ["dir1", "dir2", ...]
 * 如果 args 中包含绝对路径，说明该 server 是 filesystem 类型的。
 */
export function extractAllowedDirs(config: McpServerConfig): string[] {
  if (!config.args || config.args.length === 0) return [];
  return config.args.filter(a => !a.startsWith('-') && path.isAbsolute(a));
}

/**
 * 对带有目录配置的 MCP Server 的工具参数做路径自动解析：
 * 如果 server 配置了允许目录且工具参数中包含相对路径字符串，
 * 自动解析为允许目录下的绝对路径。
 */
function resolveFilePathArgs(
  toolName: string,
  args: Record<string, unknown>,
  config: McpServerConfig,
): Record<string, unknown> {
  const allowedDirs = extractAllowedDirs(config);
  if (allowedDirs.length === 0) return args;

  const baseDir = allowedDirs[0];
  const resolved = { ...args };

  for (const argName of PATH_ARG_NAMES) {
    const val = resolved[argName];
    if (typeof val === 'string' && val && !path.isAbsolute(val)) {
      resolved[argName] = path.resolve(baseDir, val);
      logger.debug(`mcp-client: resolved relative path "${val}" → "${resolved[argName]}"`, { toolName, argName });
    }
  }

  for (const [key, val] of Object.entries(resolved)) {
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
      const hasRelative = val.some((p: unknown) => typeof p === 'string' && !path.isAbsolute(p));
      if (hasRelative) {
        resolved[key] = val.map((p: unknown) =>
          typeof p === 'string' && !path.isAbsolute(p) ? path.resolve(baseDir, p) : p
        );
      }
    }
  }

  return resolved;
}

/**
 * 清理工具参数：移除空值（null、undefined、空字符串）的可选参数。
 * LLM 经常为可选参数传入空字符串，会导致 MCP Server 校验失败。
 */
function cleanToolArgs(args: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(args)) {
    if (val === null || val === undefined || val === '') continue;
    cleaned[key] = val;
  }
  return cleaned;
}

// ============================================================
// JSON Schema → Zod 转换
// ============================================================

/**
 * 将 JSON Schema 属性定义转换为 Zod 类型。
 * MCP Server 返回的 inputSchema 是标准 JSON Schema 格式，
 * 但 @langchain/openai 的 bindTools 需要 Zod schema 才能通过
 * openai/helpers/zod 的 zodFunction() 进行转换。
 */
function jsonSchemaPropertyToZod(prop: Record<string, unknown>): z.ZodTypeAny {
  if (prop.enum && Array.isArray(prop.enum) && prop.enum.length > 0) {
    return z.enum(prop.enum as [string, ...string[]]);
  }

  switch (prop.type) {
    case 'string':
      return z.string();
    case 'number':
    case 'integer':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'array': {
      const items = prop.items as Record<string, unknown> | undefined;
      const itemSchema = items ? jsonSchemaPropertyToZod(items) : z.unknown();
      return z.array(itemSchema);
    }
    case 'object': {
      const properties = prop.properties as Record<string, Record<string, unknown>> | undefined;
      if (properties) {
        return jsonSchemaToZod(prop as Record<string, unknown>);
      }
      return z.record(z.unknown());
    }
    default:
      return z.unknown();
  }
}

/**
 * 将完整的 JSON Schema object 转换为 z.ZodObject。
 */
function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodObject<any> {
  const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
  const required = new Set((schema.required as string[]) || []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, propDef] of Object.entries(properties)) {
    let zodType = jsonSchemaPropertyToZod(propDef);
    if (propDef.description && typeof propDef.description === 'string') {
      zodType = zodType.describe(propDef.description);
    }
    shape[key] = required.has(key) ? zodType : zodType.nullable().optional();
  }

  return z.object(shape);
}

/**
 * 确保 tool schema 是 Zod schema。
 * MCP adapter 返回的工具的 schema 是原始 JSON Schema 对象，
 * 缺少 Zod 的 _def 属性，会导致 openai 包的 zodFunction() 崩溃。
 */
function ensureZodSchema(schema: unknown): z.ZodObject<any> {
  if (
    schema &&
    typeof schema === 'object' &&
    '_def' in (schema as Record<string, unknown>) &&
    (schema as any)._def?.typeName
  ) {
    // 已经是 Zod schema
    return schema as z.ZodObject<any>;
  }
  // 原始 JSON Schema → Zod
  return jsonSchemaToZod(schema as Record<string, unknown>);
}

/**
 * 对 adapter 返回的工具进行包装：
 * - 将原始 JSON Schema 转换为 Zod schema（修复 bindTools 兼容性）
 * - 清理 LLM 传入的空值参数
 * - 自动将相对路径解析为绝对路径
 */
function wrapToolsWithArgProcessing(
  tools: DynamicStructuredTool[],
  config: McpServerConfig,
  descriptionPrefix: string,
): DynamicStructuredTool[] {
  return tools.map((tool): DynamicStructuredTool => {
    const originalFunc = tool.func.bind(tool);
    const wrappedFunc = async (input: Record<string, unknown>, runManager?: any, parentConfig?: any) => {
      const cleaned = cleanToolArgs(input);
      const resolved = resolveFilePathArgs(tool.name, cleaned, config);
      return originalFunc(resolved, runManager, parentConfig);
    };
    // 将 adapter 返回的原始 JSON Schema 转为 Zod schema，
    // 确保 @langchain/openai bindTools → zodFunction() 正常工作
    const zodSchema = ensureZodSchema(tool.schema);
    return new DynamicStructuredTool({
      name: tool.name,
      description: descriptionPrefix
        ? `${descriptionPrefix}${tool.description}`
        : tool.description,
      schema: zodSchema as any,
      responseFormat: 'content_and_artifact',
      func: wrappedFunc,
    });
  }) as DynamicStructuredTool[];
}

/**
 * 列出 MCP Server 提供的所有工具（元数据）
 */
export async function listMcpTools(config: McpServerConfig): Promise<Array<{
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}>> {
  try {
    const adapterClient = await getOrCreateClient(config);
    const sdkClient = await adapterClient.getClient(config.id);
    if (!sdkClient) {
      throw new Error(`MCP SDK client for "${config.id}" not available`);
    }
    const response = await sdkClient.listTools();
    return response.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
    }));
  } catch (err) {
    logger.error(`mcp-client: failed to list tools from "${config.id}"`, { error: err });
    return [];
  }
}

/**
 * 从 MCP Server 创建 LangChain DynamicStructuredTool 实例
 *
 * 使用 @langchain/mcp-adapters 自动完成：
 *  - JSON Schema → Zod schema 转换
 *  - isError 检查
 *  - 内容提取
 *
 * 在此基础上包装了参数清理和路径自动解析。
 */
export async function createMcpTools(
  config: McpServerConfig,
  toolNames?: string[],
  descriptionPrefix: string = '',
): Promise<DynamicStructuredTool[]> {
  try {
    logger.info(`mcp-client: creating tools from MCP server "${config.id}"`);
    const adapterClient = await getOrCreateClient(config);

    let tools = await adapterClient.getTools(config.id);
    logger.info(`mcp-client: found ${tools.length} tools from "${config.id}"`, {
      toolNames: tools.map(t => t.name),
    });

    // 过滤指定工具
    if (toolNames && toolNames.length > 0) {
      tools = tools.filter(t => toolNames.includes(t.name));
    }

    // 包装工具：参数清理 + 路径解析
    return wrapToolsWithArgProcessing(tools, config, descriptionPrefix);
  } catch (err) {
    logger.error(`mcp-client: failed to create tools from "${config.id}"`, { error: err });
    return [];
  }
}
