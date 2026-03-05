/**
 * mcp-client.ts — MCP (Model Context Protocol) 客户端管理
 *
 * 管理与 MCP Server 的连接，支持通过 MCP 协议访问外部工具。
 * 支持本地 MCP Server（通过 stdio 进程）和远程 MCP Server（通过 SSE/HTTP）。
 *
 * 参考: https://modelcontextprotocol.io/
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
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

interface McpClientEntry {
  client: Client;
  transport: StdioClientTransport | SSEClientTransport;
  config: McpServerConfig;
}

// ============================================================
// MCP 客户端缓存
// ============================================================

const mcpClients = new Map<string, McpClientEntry>();

/**
 * 获取或创建 MCP 客户端连接
 */
export async function getMcpClient(config: McpServerConfig): Promise<Client> {
  const existing = mcpClients.get(config.id);
  if (existing) {
    return existing.client;
  }

  const serverType = config.type || 'local';

  let transport: StdioClientTransport | SSEClientTransport;

  if (serverType === 'remote') {
    // 远程 MCP Server - 使用 SSE 传输
    if (!config.url) {
      throw new Error(`MCP server "${config.id}" is remote but missing url`);
    }

    logger.info(`mcp-client: connecting to remote MCP server "${config.id}"`, {
      url: config.url,
    });

    transport = new SSEClientTransport(new URL(config.url), {
      requestInit: config.headers ? { headers: config.headers } : undefined,
    });
  } else {
    // 本地 MCP Server - 使用 Stdio 传输
    if (!config.command) {
      throw new Error(`MCP server "${config.id}" is local but missing command`);
    }

    logger.info(`mcp-client: connecting to local MCP server "${config.id}"`, {
      command: config.command,
      args: config.args,
    });

    transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: { ...process.env, ...config.env } as Record<string, string>,
    });
  }

  const client = new Client({
    name: 'biosbot-agent',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  await client.connect(transport);

  mcpClients.set(config.id, { client, transport, config });
  logger.info(`mcp-client: connected to MCP server "${config.id}" (${serverType})`);

  return client;
}

/**
 * 关闭指定 MCP 客户端连接
 */
export async function closeMcpClient(serverId: string): Promise<void> {
  const entry = mcpClients.get(serverId);
  if (entry) {
    try {
      await entry.client.close();
      mcpClients.delete(serverId);
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
  for (const serverId of mcpClients.keys()) {
    await closeMcpClient(serverId);
  }
}

/**
 * 调用 MCP Server 工具
 */
export async function callMcpTool(
  config: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    const client = await getMcpClient(config);

    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    // 处理返回结果
    if (result.content && Array.isArray(result.content)) {
      const textContents = result.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map((c) => c.text);
      return textContents.join('\n').slice(0, 8000);
    }

    return JSON.stringify(result).slice(0, 8000);
  } catch (err) {
    logger.error(`mcp-client: tool "${toolName}" execution failed`, { error: err });
    throw err;
  }
}

/**
 * 列出 MCP Server 提供的所有工具
 */
export async function listMcpTools(config: McpServerConfig): Promise<Array<{
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}>> {
  try {
    const client = await getMcpClient(config);
    const response = await client.listTools();
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
 * @param config MCP Server 配置
 * @param toolName 要创建的工具名称（如果不指定则返回所有工具）
 * @param descriptionPrefix 描述前缀
 */
export async function createMcpTools(
  config: McpServerConfig,
  toolNames?: string[],
  descriptionPrefix: string = '',
): Promise<DynamicStructuredTool[]> {
  const tools: DynamicStructuredTool[] = [];

  try {
    logger.info(`mcp-client: creating tools from MCP server "${config.id}"`);
    const mcpToolList = await listMcpTools(config);
    logger.info(`mcp-client: found ${mcpToolList.length} tools from "${config.id}"`, {
      toolNames: mcpToolList.map(t => t.name),
    });

    for (const mcpTool of mcpToolList) {
      // 如果指定了工具名称列表，则只创建指定的工具
      if (toolNames && toolNames.length > 0 && !toolNames.includes(mcpTool.name)) {
        continue;
      }

      // 从 JSON Schema 构建 Zod schema
      const schema = buildZodFromJsonSchema(mcpTool.inputSchema || {});
      const description = descriptionPrefix
        ? `${descriptionPrefix}${mcpTool.description || mcpTool.name}`
        : mcpTool.description || mcpTool.name;

      const tool: DynamicStructuredTool = new DynamicStructuredTool({
        name: mcpTool.name,
        description,
        schema: schema as any,
        func: async (input: Record<string, unknown>) => {
          try {
            return await callMcpTool(config, mcpTool.name, input);
          } catch (err) {
            return `MCP tool error: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      });

      tools.push(tool);
      logger.debug(`mcp-client: created tool "${mcpTool.name}" from MCP server "${config.id}"`);
    }
  } catch (err) {
    logger.error(`mcp-client: failed to create tools from "${config.id}"`, { error: err });
  }

  return tools;
}

/**
 * 从 JSON Schema 构建简化的 Zod schema
 */
function buildZodFromJsonSchema(jsonSchema: Record<string, unknown>): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const properties = (jsonSchema.properties as Record<string, any>) || {};
  const required = (jsonSchema.required as string[]) || [];

  for (const [name, prop] of Object.entries(properties)) {
    let base: z.ZodTypeAny;
    const description = prop.description || name;

    switch (prop.type) {
      case 'number':
      case 'integer':
        base = z.number().describe(description);
        break;
      case 'boolean':
        base = z.boolean().describe(description);
        break;
      case 'array':
        base = z.array(z.any()).describe(description);
        break;
      case 'object':
        base = z.record(z.any()).describe(description);
        break;
      default:
        base = z.string().describe(description);
    }

    shape[name] = required.includes(name) ? base : base.optional();
  }

  return z.object(shape);
}
