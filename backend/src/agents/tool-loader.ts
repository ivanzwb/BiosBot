/**
 * tool-loader.ts — Agent Tool 自动发现与加载（JSON 配置驱动）
 *
 * 扫描指定目录下的 tools/ 子目录，读取每个 .json 文件并创建 DynamicStructuredTool 实例。
 *
 * 约定：
 *  - Tool 定义文件位于 <agent-dir>/tools/<tool-id>.json
 *  - 每个文件包含: id, name, description, parameters[], handler
 *  - handler 支持两种类型：
 *    1. "http" — 发起 HTTP 请求，URL / Header / Body 中可使用 {{paramName}} 占位符
 *    2. "script" — 执行上传的脚本文件（Node.js / Python / Bash），参数通过 JSON stdin 传入
 *  - 脚本文件存放在 <agent-dir>/tools/scripts/ 目录下
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import logger from '../infra/logger/logger';

// ============================================================
// 类型定义
// ============================================================

export interface ToolParamDef {
  /** 参数名称 */
  name: string;
  /** 参数类型 */
  type: 'string' | 'number' | 'boolean';
  /** 参数描述（展示给 LLM） */
  description: string;
  /** 是否必填（默认 true） */
  required?: boolean;
}

export interface HttpHandler {
  type: 'http';
  /** 请求 URL（支持 {{param}} 占位符） */
  url: string;
  /** HTTP 方法（默认 GET） */
  method?: string;
  /** 请求头（值支持 {{param}} 占位符） */
  headers?: Record<string, string>;
  /** 请求体模板（POST/PUT 时使用，支持 {{param}} 占位符） */
  bodyTemplate?: string;
}

export interface ScriptHandler {
  type: 'script';
  /** 脚本文件名（存放在 tools/scripts/ 目录下） */
  scriptFile: string;
  /** 脚本运行时 */
  runtime: 'node' | 'python' | 'bash';
  /** 执行超时（毫秒，默认 30000） */
  timeout?: number;
}

export type ToolHandler = HttpHandler | ScriptHandler;

export interface AgentToolConfig {
  /** Tool 唯一标识（与文件名对应） */
  id: string;
  /** Tool 名称（用于 LLM tool-calling） */
  name: string;
  /** Tool 功能描述（展示给 LLM） */
  description: string;
  /** 参数定义列表 */
  parameters: ToolParamDef[];
  /** 执行处理器配置 */
  handler: ToolHandler;
  /** 是否启用（默认 true） */
  enabled?: boolean;
}

// ============================================================
// 内部辅助
// ============================================================

/**
 * 将参数定义数组转换为 Zod schema。
 * 返回 z.ZodObject<any> 以避免与 DynamicStructuredTool 组合时的深度实例化问题。
 */
function buildZodSchema(params: ToolParamDef[]): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of params) {
    let base: z.ZodTypeAny;
    switch (p.type) {
      case 'number':
        base = z.number().describe(p.description);
        break;
      case 'boolean':
        base = z.boolean().describe(p.description);
        break;
      default:
        base = z.string().describe(p.description);
    }
    shape[p.name] = p.required === false ? base.optional() : base;
  }
  return z.object(shape);
}

/**
 * 替换模板字符串中的 {{paramName}} 占位符。
 */
function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(params[key] ?? ''));
}

/**
 * 执行 HTTP 类型的 Tool handler。
 */
async function executeHttpHandler(
  handler: HttpHandler,
  params: Record<string, unknown>,
): Promise<string> {
  const url = interpolate(handler.url, params);
  const method = (handler.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {};

  if (handler.headers) {
    for (const [k, v] of Object.entries(handler.headers)) {
      headers[k] = interpolate(v, params);
    }
  }

  const fetchOptions: RequestInit = { method, headers };

  if (handler.bodyTemplate && ['POST', 'PUT', 'PATCH'].includes(method)) {
    fetchOptions.body = interpolate(handler.bodyTemplate, params);
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const response = await fetch(url, fetchOptions);
  const text = await response.text();

  if (!response.ok) {
    return `HTTP ${response.status}: ${text.slice(0, 500)}`;
  }
  // 截断过长响应，避免占满 LLM 上下文
  return text.slice(0, 4000);
}

/**
 * 执行 Script 类型的 Tool handler。
 * 脚本通过 stdin 接收 JSON 参数，通过 stdout 返回结果。
 */
async function executeScriptHandler(
  handler: ScriptHandler,
  params: Record<string, unknown>,
  agentDir: string,
): Promise<string> {
  const scriptPath = path.join(agentDir, 'tools', 'scripts', handler.scriptFile);
  if (!fs.existsSync(scriptPath)) {
    return `Script file not found: ${handler.scriptFile}`;
  }

  const runtimeMap: Record<string, string> = {
    node: process.execPath,           // 使用当前 Node.js 执行
    python: process.platform === 'win32' ? 'python' : 'python3',
    bash: process.platform === 'win32' ? 'bash' : '/bin/bash',
  };

  const runtime = runtimeMap[handler.runtime] || handler.runtime;
  const timeout = handler.timeout || 30000;

  return new Promise((resolve) => {
    const child = execFile(runtime, [scriptPath], {
      timeout,
      maxBuffer: 1024 * 1024,    // 1 MB
      env: { ...process.env, TOOL_PARAMS: JSON.stringify(params) },
    }, (error, stdout, stderr) => {
      if (error) {
        const errMsg = error.killed
          ? `Script execution timed out after ${timeout}ms`
          : `Script error: ${stderr || error.message}`;
        resolve(errMsg.slice(0, 2000));
        return;
      }
      // 优先返回 stdout，截断过长结果
      const result = (stdout || stderr).trim();
      resolve(result.slice(0, 4000));
    });

    // 通过 stdin 传递参数（JSON 格式）
    if (child.stdin) {
      child.stdin.write(JSON.stringify(params));
      child.stdin.end();
    }
  });
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 从 Agent 目录加载 tools/ 子目录中的所有 Tool 配置（.json 文件），
 * 并创建对应的 DynamicStructuredTool 实例。
 *
 * @param agentDir Agent 根目录
 * @returns { configs: 原始配置, tools: LangChain 工具实例 }
 */
export function loadAgentTools(agentDir: string): {
  configs: AgentToolConfig[];
  tools: DynamicStructuredTool[];
} {
  const toolsDir = path.join(agentDir, 'tools');
  const configs: AgentToolConfig[] = [];
  const tools: DynamicStructuredTool[] = [];

  if (!fs.existsSync(toolsDir)) {
    return { configs, tools };
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(toolsDir);
  } catch (err) {
    logger.error(`tool-loader: failed to read tools dir "${toolsDir}"`, { error: err });
    return { configs, tools };
  }

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;

    const filePath = path.join(toolsDir, entry);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const cfg: AgentToolConfig = JSON.parse(raw);

      if (!cfg.id || !cfg.name || !cfg.description) {
        logger.warn(`tool-loader: "${entry}" missing required fields (id, name, description), skipped`);
        continue;
      }

      // 跳过禁用的 Tool
      if (cfg.enabled === false) {
        configs.push(cfg);
        continue;
      }

      configs.push(cfg);

      const schema = buildZodSchema(cfg.parameters || []);
      const handler = cfg.handler;

      const tool: DynamicStructuredTool = new DynamicStructuredTool({
        name: cfg.name,
        description: cfg.description,
        schema: schema as any,
        func: async (input: Record<string, unknown>) => {
          try {
            if (handler?.type === 'http') {
              return await executeHttpHandler(handler as HttpHandler, input);
            }
            if (handler?.type === 'script') {
              return await executeScriptHandler(handler as ScriptHandler, input, agentDir);
            }
            return `Unsupported handler type: ${(handler as any)?.type}`;
          } catch (err) {
            logger.error(`tool-loader: tool "${cfg.name}" execution failed`, { error: err });
            return `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      });

      tools.push(tool);
      logger.debug(`tool-loader: loaded tool "${cfg.id}" from "${filePath}"`);
    } catch (err) {
      logger.warn(`tool-loader: failed to load "${entry}" in "${toolsDir}"`, { error: err });
    }
  }

  return { configs, tools };
}

/**
 * 仅加载 Tool 配置（不创建 DynamicStructuredTool 实例），用于 API 列表展示。
 */
export function loadAgentToolConfigs(agentDir: string): AgentToolConfig[] {
  return loadAgentTools(agentDir).configs;
}
