/**
 * LanceDb 连接封装
 *
 * 每个 Agent 维护自己的向量库。
 * 默认目录：Agent 源码目录下的 lancedb/ 子目录（即 <agent-dir>/lancedb/）。
 * 如果 Agent 未提供 dataDir（兜底场景），回退到集中目录 database/lancedb/<agent-id>。
 * 通过 LangChain 的 VectorStore + Retriever 接口访问。
 * 此文件提供基础连接工厂，具体使用在各 Agent 的 rag/ 目录中。
 */

import path from 'path';
import fs from 'fs';
import logger from '../logger/logger';

/** 集中式兜底目录 */
const LANCEDB_FALLBACK_BASE = path.resolve(__dirname, '../../../../database/lancedb');

/**
 * 获取某个 Agent 的 LanceDb 数据目录，不存在则自动创建。
 *
 * @param agentId   Agent 唯一标识
 * @param dataDir   Agent 的源码目录（来自 DomainAgent.dataDir），为空则使用兜底集中目录
 */
export function getLanceDbDir(agentId: string, dataDir?: string): string {
  const dir = dataDir
    ? path.join(dataDir, 'lancedb')
    : path.join(LANCEDB_FALLBACK_BASE, agentId);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`lancedb.client: created LanceDb directory for "${agentId}": ${dir}`);
  }
  return dir;
}
