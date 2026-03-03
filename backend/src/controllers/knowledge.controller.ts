/**
 * knowledge.controller.ts — 知识库管理控制器
 *
 * 提供知识库状态查询和清空功能，配合 RAG 服务使用。
 */

import { Request, Response, NextFunction } from 'express';
import { getLanceDbDir } from '../infra/db/lancedb.client';
import { getRegisteredAgents } from '../agents/proxy-agent';
import { hasKnowledge } from '../agents/rag-service';
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
