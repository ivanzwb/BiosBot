/**
 * rag-tool.ts — 将 RAG 知识检索暴露为 LangChain Tool，供 LLM 按需调用
 *
 * 类似 skill-tool.ts 的 use_skill 工具，这里提供 query_knowledge 工具：
 *  - LLM 判断需要额外知识时，调用 query_knowledge(query) 检索 Agent 专属知识库
 *  - 返回相关文档片段，LLM 结合检索结果生成最终回答
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchKnowledge } from './rag-service';
import logger from '../infra/logger/logger';

export interface RagToolOptions {
  /** Agent 唯一标识 */
  agentId: string;
  /** Agent 的源码目录（用于定位 LanceDB 目录） */
  dataDir?: string;
  /** 检索返回的最大片段数 */
  topK?: number;
}

/**
 * 为指定 Agent 创建 query_knowledge 工具。
 * 若 agent 有知识库，LLM 可调用此工具检索相关文档片段。
 */
export function createRagTool(options: RagToolOptions): DynamicStructuredTool {
  const { agentId, dataDir, topK = 5 } = options;

  const ragSchema = z.object({
      query: z.string().describe('用于检索知识库的自然语言查询'),
    });

  return new DynamicStructuredTool({
    name: 'query_knowledge',
    description:
      '从知识库中检索与查询相关的文档片段。当你需要查找特定领域知识、历史数据或参考资料时使用此工具。' +
      '传入自然语言查询，返回最相关的文档片段。',
    schema: ragSchema as any,
    func: async ({ query }: { query: string }) => {
      logger.debug(`query_knowledge tool: agent="${agentId}", query="${query}"`);
      try {
        const results = await searchKnowledge(agentId, query, topK, dataDir);
        if (results.length === 0) {
          return '知识库中未找到相关内容。请基于你已有的知识回答。';
        }

        // 格式化检索结果
        const formatted = results
          .map((r, i) => {
            const header = `[${i + 1}] ${r.title} (相关度: ${(r.score * 100).toFixed(1)}%)`;
            return `${header}\n${r.text}`;
          })
          .join('\n\n---\n\n');

        return `从知识库检索到 ${results.length} 条相关片段：\n\n${formatted}`;
      } catch (err) {
        logger.error(`query_knowledge tool failed for agent "${agentId}"`, { error: err });
        return `知识库检索失败: ${err instanceof Error ? err.message : String(err)}。请基于你已有的知识回答。`;
      }
    },
  }) as DynamicStructuredTool;
}

/**
 * 生成知识库提示文本（嵌入 system prompt 中，告知 LLM 知识库可用）。
 */
export function buildRagPrompt(agentId: string): string {
  return (
    `你可以通过 query_knowledge 工具查询你的专属知识库。` +
    `当用户的问题涉及特定数据、文档或历史信息时，请先调用 query_knowledge 检索相关内容，再结合检索结果回答。`
  );
}
