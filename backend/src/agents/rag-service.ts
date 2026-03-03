/**
 * rag-service.ts — RAG（检索增强生成）核心服务
 *
 * 提供文档向量化、入库、检索能力：
 *  - ingestDocuments()  — 将文档切片、嵌入并写入 LanceDB
 *  - searchKnowledge()  — 将 query 嵌入后在 LanceDB 中检索相似文档
 *
 * 每个 Agent 有独立的 LanceDB 表（基于 agentId），物理目录由 getLanceDbDir() 决定。
 * 嵌入模型统一使用 OpenAI Embeddings（兼容所有 OpenAI-compatible 端点）。
 */

import * as lancedb from '@lancedb/lancedb';
import { OpenAIEmbeddings } from '@langchain/openai';
import { getLanceDbDir } from '../infra/db/lancedb.client';
import { getConfigJSON } from '../models/config.model';
import logger from '../infra/logger/logger';

/** LanceDB 表名 */
const TABLE_NAME = 'knowledge';

/** 默认嵌入模型 */
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-ada-002';

/** 切片最大字符数（简单按字符切分） */
const CHUNK_SIZE = 1000;
/** 切片重叠字符数 */
const CHUNK_OVERLAP = 200;

// ============================================================
// 嵌入模型工厂
// ============================================================

interface EmbeddingConfig {
  apiKey: string;
  model?: string;
  /** OpenAI-compatible 端点（如阿里云 DashScope） */
  baseUrl?: string;
}

/**
 * 获取嵌入模型配置。
 * 优先使用 agent-specific 配置，然后回退 default 配置。
 */
function getEmbeddingConfig(agentId?: string): EmbeddingConfig {
  const mapping = getConfigJSON<any>('agent_model_mapping');
  const keys = getConfigJSON<Record<string, string>>('api_keys');

  // 优先使用 agent 配置的 provider
  const agentCfg = agentId ? mapping?.agents?.[agentId] : undefined;
  const provider = agentCfg?.model?.provider || mapping?.defaultModel?.provider || 'openai';
  const apiKey = keys?.[provider] || process.env[`${provider.toUpperCase()}_API_KEY`] || '';

  return {
    apiKey,
    model: DEFAULT_EMBEDDING_MODEL,
  };
}

/**
 * 创建 OpenAI Embeddings 实例。
 */
function createEmbeddingModel(cfg: EmbeddingConfig): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    openAIApiKey: cfg.apiKey,
    modelName: cfg.model || DEFAULT_EMBEDDING_MODEL,
    ...(cfg.baseUrl ? { configuration: { baseURL: cfg.baseUrl } } : {}),
  });
}

// ============================================================
// 文本切片
// ============================================================

interface TextChunk {
  text: string;
  docId: string;
  title: string;
  chunkIndex: number;
}

/**
 * 将长文本按固定大小切片（重叠）。
 */
function splitText(text: string, docId: string, title: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  if (text.length <= CHUNK_SIZE) {
    chunks.push({ text, docId, title, chunkIndex: 0 });
    return chunks;
  }

  let start = 0;
  let idx = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push({ text: text.slice(start, end), docId, title, chunkIndex: idx });
    start += CHUNK_SIZE - CHUNK_OVERLAP;
    idx++;
  }
  return chunks;
}

// ============================================================
// LanceDB 连接管理
// ============================================================

/** 缓存已打开的 LanceDB 连接（按目录路径） */
const connectionCache = new Map<string, lancedb.Connection>();

async function getConnection(dbDir: string): Promise<lancedb.Connection> {
  let conn = connectionCache.get(dbDir);
  if (!conn) {
    conn = await lancedb.connect(dbDir);
    connectionCache.set(dbDir, conn);
  }
  return conn;
}

// ============================================================
// 文档导入
// ============================================================

export interface IngestDocument {
  id: string;
  title: string;
  content: string;
}

/**
 * 将文档向量化后写入 Agent 的 LanceDB 知识库。
 *
 * @param agentId    Agent 唯一标识
 * @param documents  待导入的文档列表
 * @param dataDir    Agent 的源码目录（用于 getLanceDbDir）
 * @returns 导入的向量条数
 */
export async function ingestDocuments(
  agentId: string,
  documents: IngestDocument[],
  dataDir?: string,
): Promise<number> {
  if (documents.length === 0) return 0;

  const embCfg = getEmbeddingConfig(agentId);
  if (!embCfg.apiKey) {
    throw new Error(`No API key configured for agent "${agentId}", cannot generate embeddings.`);
  }

  const embedModel = createEmbeddingModel(embCfg);

  // 1. 切片
  const allChunks: TextChunk[] = [];
  for (const doc of documents) {
    const chunks = splitText(doc.content, doc.id, doc.title);
    allChunks.push(...chunks);
  }
  logger.info(`rag-service: split ${documents.length} doc(s) into ${allChunks.length} chunk(s) for "${agentId}"`);

  // 2. 批量嵌入
  const texts = allChunks.map((c) => c.text);
  const vectors = await embedModel.embedDocuments(texts);

  // 3. 构造 LanceDB 记录
  const records = allChunks.map((chunk, i) => ({
    vector: vectors[i],
    text: chunk.text,
    doc_id: chunk.docId,
    title: chunk.title,
    chunk_index: chunk.chunkIndex,
  }));

  // 4. 写入 LanceDB
  const dbDir = getLanceDbDir(agentId, dataDir);
  const conn = await getConnection(dbDir);

  try {
    // 尝试打开已有表，追加数据
    const table = await conn.openTable(TABLE_NAME);
    await table.add(records);
    logger.info(`rag-service: appended ${records.length} record(s) to "${agentId}" knowledge table`);
  } catch {
    // 表不存在 — 创建新表
    await conn.createTable(TABLE_NAME, records);
    logger.info(`rag-service: created knowledge table for "${agentId}" with ${records.length} record(s)`);
  }

  return records.length;
}

// ============================================================
// 知识检索
// ============================================================

export interface SearchResult {
  text: string;
  docId: string;
  title: string;
  score: number;
}

/**
 * 在 Agent 的 LanceDB 知识库中检索与 query 最相似的文档片段。
 *
 * @param agentId  Agent 唯一标识
 * @param query    用户查询文本
 * @param topK     返回结果数（默认 5）
 * @param dataDir  Agent 的源码目录
 * @returns 相似度从高到低排列的文档片段
 */
export async function searchKnowledge(
  agentId: string,
  query: string,
  topK = 5,
  dataDir?: string,
): Promise<SearchResult[]> {
  const embCfg = getEmbeddingConfig(agentId);
  if (!embCfg.apiKey) {
    logger.warn(`rag-service: no API key for "${agentId}", skip knowledge search`);
    return [];
  }

  const dbDir = getLanceDbDir(agentId, dataDir);
  let conn: lancedb.Connection;
  try {
    conn = await getConnection(dbDir);
  } catch (err) {
    logger.warn(`rag-service: failed to connect to LanceDB for "${agentId}"`, { error: err });
    return [];
  }

  let table: lancedb.Table;
  try {
    table = await conn.openTable(TABLE_NAME);
  } catch {
    // 表不存在 — 该 Agent 还没有知识库
    logger.debug(`rag-service: no knowledge table for "${agentId}"`);
    return [];
  }

  // 嵌入查询向量
  const embedModel = createEmbeddingModel(embCfg);
  const queryVector = await embedModel.embedQuery(query);

  // 向量检索
  const raw = await table.search(queryVector).limit(topK).toArray();

  return raw.map((row: any) => ({
    text: row.text as string,
    docId: row.doc_id as string,
    title: row.title as string,
    score: row._distance != null ? 1 / (1 + row._distance) : 0,
  }));
}

/**
 * 检查某 Agent 是否已有知识库数据。
 */
export async function hasKnowledge(agentId: string, dataDir?: string): Promise<boolean> {
  const dbDir = getLanceDbDir(agentId, dataDir);
  try {
    const conn = await getConnection(dbDir);
    const tables = await conn.tableNames();
    return tables.includes(TABLE_NAME);
  } catch {
    return false;
  }
}
