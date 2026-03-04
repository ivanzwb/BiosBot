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

/** 默认嵌入模型（按 baseUrl 自动选择） */
function pickDefaultEmbeddingModel(baseUrl?: string): string {
  if (baseUrl && baseUrl.includes('dashscope')) return 'text-embedding-v3';
  return 'text-embedding-ada-002';
}

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
 * 从 models 配置中读取默认模型的 apiKey / baseUrl。
 */
function getEmbeddingConfig(_agentId?: string): EmbeddingConfig {
  const models = getConfigJSON<any[]>('models') || [];
  const mapping = getConfigJSON<any>('agent_model_mapping');
  const rawDefault = mapping?.defaultModel || '';
  // 兼容旧格式: { provider, model } → 取 model 字段
  const defaultId = rawDefault && typeof rawDefault === 'object'
    ? (rawDefault.model || rawDefault.id || '')
    : rawDefault;
  const entry = models.find((m: any) => m.id === defaultId)
    || models.find((m: any) => m.model === defaultId)
    || models[0];

  const apiKey = entry?.apiKey || process.env.OPENAI_API_KEY || '';
  const baseUrl = entry?.baseUrl || process.env.OPENAI_BASE_URL || '';
  const embeddingModel = entry?.embeddingModel || pickDefaultEmbeddingModel(baseUrl);

  return {
    apiKey,
    model: embeddingModel,
    ...(baseUrl ? { baseUrl } : {}),
  };
}

/**
 * 创建 OpenAI Embeddings 实例。
 */
function createEmbeddingModel(cfg: EmbeddingConfig): OpenAIEmbeddings {
  const modelName = cfg.model || pickDefaultEmbeddingModel(cfg.baseUrl);
  return new OpenAIEmbeddings({
    openAIApiKey: cfg.apiKey,
    modelName,
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
  const raw = await (table as any).search(queryVector).limit(topK).toArray();

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

// ============================================================
// 文档列表 & 删除
// ============================================================

export interface DocumentSummary {
  docId: string;
  title: string;
  chunkCount: number;
}

/**
 * 列出某 Agent 知识库中已导入的文档摘要（按 doc_id 去重）。
 */
export async function listDocuments(agentId: string, dataDir?: string): Promise<DocumentSummary[]> {
  const dbDir = getLanceDbDir(agentId, dataDir);
  let conn: lancedb.Connection;
  try {
    conn = await getConnection(dbDir);
  } catch {
    return [];
  }

  let table: lancedb.Table;
  try {
    table = await conn.openTable(TABLE_NAME);
  } catch {
    return [];
  }

  // 全量扫描（LanceDB v0.4+ 使用 query() 进行非向量查询）
  let rows: any[];
  try {
    rows = await table.query().select(['doc_id', 'title']).limit(100000).toArray();
  } catch {
    // fallback: 尝试旧版 API
    try {
      rows = await (table as any).search([]).select(['doc_id', 'title']).limit(100000).toArray();
    } catch {
      return [];
    }
  }
  const map = new Map<string, { title: string; count: number }>();
  for (const row of rows) {
    const docId = row.doc_id as string;
    const existing = map.get(docId);
    if (existing) {
      existing.count++;
    } else {
      map.set(docId, { title: row.title as string, count: 1 });
    }
  }

  return Array.from(map.entries()).map(([docId, info]) => ({
    docId,
    title: info.title,
    chunkCount: info.count,
  }));
}

/**
 * 删除某 Agent 知识库中指定 doc_id 的所有向量记录。
 */
export async function deleteDocument(agentId: string, docId: string, dataDir?: string): Promise<number> {
  const dbDir = getLanceDbDir(agentId, dataDir);
  let conn: lancedb.Connection;
  try {
    conn = await getConnection(dbDir);
  } catch {
    return 0;
  }

  let table: lancedb.Table;
  try {
    table = await conn.openTable(TABLE_NAME);
  } catch {
    return 0;
  }

  // 统计删除前的条数
  let before: any[];
  try {
    before = await table.query().select(['doc_id']).limit(100000).toArray();
  } catch {
    try {
      before = await (table as any).search([]).select(['doc_id']).limit(100000).toArray();
    } catch {
      before = [];
    }
  }
  const countBefore = before.filter((r: any) => r.doc_id === docId).length;

  // LanceDB 支持 filter delete
  await table.delete(`doc_id = '${docId.replace(/'/g, "''")}'`);

  logger.info(`rag-service: deleted ${countBefore} chunk(s) for doc "${docId}" from "${agentId}"`);
  return countBefore;
}
