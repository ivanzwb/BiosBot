/**
 * knowledge.controller.ts — 知识库管理控制器
 *
 * 提供知识库状态查询、文档列表、文档删除、对话导入知识库等功能。
 */

import { Request, Response, NextFunction } from 'express';
import { getLanceDbDir } from '../infra/db/lancedb.client';
import { getRegisteredAgents } from '../agents/proxy-agent';
import { hasKnowledge, listDocuments, deleteDocument, ingestDocuments } from '../agents/rag-service';
import { getConfigJSON } from '../models/config.model';
import * as ChatService from '../services/chat.service';
import * as TaskService from '../services/task.service';
import { generateId } from '../utils/uuid';
import logger from '../infra/logger/logger';
import * as fs from 'fs';

/** 根据 agentId 查找已注册 Agent 的 dataDir */
function resolveAgentDataDir(agentId: string): string | undefined {
  const agent = getRegisteredAgents().find((a) => a.id === agentId);
  return agent?.dataDir;
}

/**
 * GET /api/knowledge/:agentId
 *
 * 获取某 Agent 知识库状态（是否有数据、文件数量等）
 */
export async function getKnowledgeStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const agentId = req.params.agentId as string;
    const dataDir = resolveAgentDataDir(agentId);
    const dir = getLanceDbDir(agentId, dataDir);
    const exists = fs.existsSync(dir);

    // 简易统计：目录是否存在 + 子文件数
    let fileCount = 0;
    if (exists) {
      try {
        fileCount = fs.readdirSync(dir).length;
      } catch {
        // ignore
      }
    }

    // 检查是否有实际的知识库数据
    const hasData = await hasKnowledge(agentId, dataDir);

    res.json({
      agentId,
      lanceDbDir: dir,
      initialized: exists,
      hasData,
      fileCount,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/knowledge/:agentId
 *
 * 清空某 Agent 的知识库（删除 LanceDb 目录）
 */
export function clearKnowledge(req: Request, res: Response, next: NextFunction): void {
  try {
    const agentId = req.params.agentId as string;
    const dataDir = resolveAgentDataDir(agentId);
    const dir = getLanceDbDir(agentId, dataDir);

    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      logger.info('knowledge.controller: cleared knowledge for', { agentId });
    }

    res.json({ success: true, agentId });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/knowledge/:agentId/documents
 *
 * 列出某 Agent 知识库中的文档摘要
 */
export async function listKnowledgeDocs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const agentId = req.params.agentId as string;
    const dataDir = resolveAgentDataDir(agentId);
    const docs = await listDocuments(agentId, dataDir);
    res.json(docs);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/knowledge/:agentId/documents/:docId
 *
 * 删除某 Agent 知识库中的指定文档
 */
export async function deleteKnowledgeDoc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const agentId = req.params.agentId as string;
    const docId = req.params.docId as string;
    const dataDir = resolveAgentDataDir(agentId);
    const deleted = await deleteDocument(agentId, docId, dataDir);
    res.json({ success: true, agentId, docId, deletedChunks: deleted });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/knowledge/:agentId/ingest-conversation
 *
 * 将指定对话的内容导入到某 Agent 的知识库。
 * body: { conversationId: string, messageIds?: string[] }
 *   - 如果提供 messageIds，仅导入指定消息
 *   - 否则导入整个对话的 assistant 消息
 */
export async function ingestConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const agentId = req.params.agentId as string;
    const { conversationId, messageIds } = req.body as { conversationId: string; messageIds?: string[] };

    if (!conversationId) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'conversationId required' });
      return;
    }

    const allMessages = ChatService.listMessages(conversationId);
    if (allMessages.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: '对话不存在或无消息' });
      return;
    }

    // 筛选要导入的消息
    let msgs = messageIds?.length
      ? allMessages.filter(m => messageIds.includes(m.id))
      : allMessages.filter(m => m.role === 'assistant' || m.role === 'agent');

    if (msgs.length === 0) {
      res.status(400).json({ code: 'NO_CONTENT', message: '无可导入的消息内容' });
      return;
    }

    const conversation = ChatService.getConversation(conversationId);
    const title = conversation?.title || '对话记录';

    // 将消息合并为文档
    const documents = msgs.map(m => ({
      id: m.id,
      title: `${title} - ${new Date(m.created_at).toLocaleString('zh-CN')}`,
      content: m.content,
    }));

    const agent = getRegisteredAgents().find(a => a.id === agentId);
    const dataDir = agent?.dataDir;

    // 创建异步任务
    const task = TaskService.createTask('ingest', { agentId, conversationId, messageCount: documents.length }, conversationId);

    setImmediate(async () => {
      try {
        const recordCount = await ingestDocuments(agentId, documents, dataDir);
        logger.info('knowledge.controller ingest-conversation: completed', { agentId, conversationId, records: recordCount });
        TaskService.succeedTask(task.id, { imported: documents.length, records: recordCount });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error('knowledge.controller ingest-conversation error', { agentId, error: err });
        TaskService.failTask(task.id, errorMsg);
      }
    });

    res.status(202).json({ taskId: task.id, status: 'pending', messageCount: documents.length });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/knowledge/all-status
 *
 * 获取所有 Agent 的知识库状态摘要
 */
export async function getAllKnowledgeStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const agents = getRegisteredAgents();
    const result = await Promise.all(agents.map(async (agent) => {
      const dataDir = agent.dataDir;
      const dir = getLanceDbDir(agent.id, dataDir);
      const exists = fs.existsSync(dir);
      const hasData = await hasKnowledge(agent.id, dataDir);
      const docs = hasData ? await listDocuments(agent.id, dataDir) : [];
      return {
        agentId: agent.id,
        agentName: agent.name,
        hasData,
        documentCount: docs.length,
        totalChunks: docs.reduce((sum, d) => sum + d.chunkCount, 0),
      };
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
}
