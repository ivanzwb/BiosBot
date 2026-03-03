// ============================================================
// HTTP API 请求 / 响应类型
// ============================================================

/** 统一错误结构 */
export interface ApiError {
  code: string;
  message: string;
  detail?: string;
}

/** POST /api/intent/classify */
export interface ClassifyRequest {
  query: string;
  conversationId: string;
}

export interface ClassifyResponse {
  intent: string;
  domains: string[];
  confidence: number;
}

/** POST /api/agent/invoke */
export interface InvokeRequest {
  conversationId: string;
  agentId?: string;
  query: string;
  context?: { extra?: unknown };
  options?: { temperature?: number; maxTokens?: number };
}

export interface InvokeResponse {
  taskId: string;
  status: string;
  answer: string | null;
}

/** POST /api/agent/ingest */
export interface IngestRequest {
  agentId: string;
  conversationId: string;
  documents: Array<{ id: string; title: string; content: string }>;
}

export interface IngestResponse {
  taskId: string;
  status: string;
}

/** POST /api/conversations */
export interface CreateConversationRequest {
  title?: string;
}

/** PUT /api/admin/configs/:key */
export interface UpdateConfigRequest {
  value: string;
  scope?: 'system' | 'agent';
}
