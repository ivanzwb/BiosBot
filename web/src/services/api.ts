/**
 * api.ts — HTTP API 客户端
 *
 * 封装所有后端 REST API 调用。
 * 开发时通过 Vite proxy 转发 /api → http://localhost:3000。
 */

const BASE = '/api';

// ============================================================
// 模型测试
// ============================================================

export interface TestModelResult {
  success: boolean;
  latency?: number;
  reply?: string;
  message?: string;
  testedAt?: string;
}

export function testModel(params: {
  modelId?: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
}): Promise<TestModelResult> {
  return request('/admin/test-model', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function getModelTestResults(): Promise<Record<string, TestModelResult>> {
  return getConfig('model_test_results')
    .then((cfg) => JSON.parse(cfg.value))
    .catch(() => ({}));
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ============================================================
// 对话
// ============================================================

export interface Conversation {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'agent';
  content: string;
  agent_id?: string;
  created_at: string;
}

export function listConversations(): Promise<Conversation[]> {
  return request('/conversations');
}

export function createConversation(title?: string): Promise<Conversation> {
  return request('/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export function getConversation(id: string): Promise<Conversation> {
  return request(`/conversations/${id}`);
}

export function updateConversation(id: string, fields: { title?: string; status?: string }): Promise<void> {
  return request(`/conversations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

export function deleteConversation(id: string): Promise<void> {
  return request(`/conversations/${id}`, { method: 'DELETE' });
}

export function listMessages(conversationId: string): Promise<Message[]> {
  return request(`/conversations/${conversationId}/messages`);
}

export function generateTitle(conversationId: string): Promise<{ title: string }> {
  return request(`/conversations/${conversationId}/generate-title`, { method: 'POST' });
}

// ============================================================
// Agent 调用
// ============================================================

export interface InvokeResult {
  taskId: string;
  status: string;
  answer: string | null;
}

export function invokeAgent(
  conversationId: string,
  query: string,
  agentId?: string,
): Promise<InvokeResult> {
  return request('/agent/invoke', {
    method: 'POST',
    body: JSON.stringify({ conversationId, query, agentId }),
  });
}

// ============================================================
// 任务轮询
// ============================================================

export interface Task {
  id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';
  result?: string;
  error?: string;
}

export function getTask(id: string): Promise<Task> {
  return request(`/tasks/${id}`);
}

// ============================================================
// Agent 列表
// ============================================================

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  labels?: string[];
  enabled: boolean;
  model?: string;
  defaultTemperature?: number;
  systemPrompt?: string;
  source?: 'db' | 'file';
}

export function listAgents(): Promise<AgentInfo[]> {
  return request('/agents');
}

export function createAgent(agent: {
  id: string;
  name: string;
  description?: string;
  labels?: string[];
  defaultTemperature?: number;
  systemPrompt?: string;
}): Promise<{ success: boolean; agent: AgentInfo }> {
  return request('/agents', {
    method: 'POST',
    body: JSON.stringify(agent),
  });
}

export function deleteAgent(agentId: string): Promise<{ success: boolean }> {
  return request(`/agents/${agentId}`, { method: 'DELETE' });
}

export function updateAgentConfig(
  agentId: string,
  fields: { name?: string; description?: string; labels?: string[]; defaultTemperature?: number; systemPrompt?: string },
): Promise<{ success: boolean }> {
  return request(`/agents/${agentId}/config`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

export function refreshAgents(): Promise<{ registered: number }> {
  return request('/agents/refresh', { method: 'POST' });
}

// ============================================================
// 配置管理
// ============================================================

export interface ConfigRecord {
  key: string;
  value: string;
  scope: string;
  updated_at: string;
}

export function listConfigs(): Promise<ConfigRecord[]> {
  return request('/admin/configs');
}

export function getConfig(key: string): Promise<ConfigRecord> {
  return request(`/admin/configs/${key}`);
}

export function updateConfig(key: string, value: string): Promise<void> {
  return request(`/admin/configs/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

// ============================================================
// 知识库管理
// ============================================================

export interface KnowledgeStatus {
  agentId: string;
  agentName: string;
  hasData: boolean;
  documentCount: number;
  totalChunks: number;
}

export interface DocumentSummary {
  docId: string;
  title: string;
  chunkCount: number;
}

export function getAllKnowledgeStatus(): Promise<KnowledgeStatus[]> {
  return request('/knowledge/all-status');
}

export function getKnowledgeStatus(agentId: string): Promise<{
  agentId: string;
  initialized: boolean;
  hasData: boolean;
  fileCount: number;
}> {
  return request(`/knowledge/${agentId}`);
}

export function listKnowledgeDocs(agentId: string): Promise<DocumentSummary[]> {
  return request(`/knowledge/${agentId}/documents`);
}

export function deleteKnowledgeDoc(agentId: string, docId: string): Promise<{ success: boolean }> {
  return request(`/knowledge/${agentId}/documents/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
  });
}

export function clearKnowledge(agentId: string): Promise<{ success: boolean }> {
  return request(`/knowledge/${agentId}`, { method: 'DELETE' });
}

export function ingestConversation(
  agentId: string,
  conversationId: string,
  messageIds?: string[],
): Promise<{ taskId: string; status: string; messageCount: number }> {
  return request(`/knowledge/${agentId}/ingest-conversation`, {
    method: 'POST',
    body: JSON.stringify({ conversationId, messageIds }),
  });
}

export function ingestDocuments(
  agentId: string,
  documents: Array<{ id: string; title: string; content: string }>,
  conversationId?: string,
): Promise<{ taskId: string; status: string }> {
  return request('/agent/ingest', {
    method: 'POST',
    body: JSON.stringify({ agentId, conversationId: conversationId || '', documents }),
  });
}

// ============================================================
// Skill 管理
// ============================================================

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  content: string;
}

export function listSkills(agentId: string): Promise<SkillInfo[]> {
  return request(`/agents/${agentId}/skills`);
}

export function createSkill(
  agentId: string,
  skill: { id: string; name: string; description?: string; content: string },
): Promise<{ success: boolean; skill: SkillInfo }> {
  return request(`/agents/${agentId}/skills`, {
    method: 'POST',
    body: JSON.stringify(skill),
  });
}

export function updateSkill(
  agentId: string,
  skillId: string,
  fields: { name?: string; description?: string; content?: string },
): Promise<{ success: boolean; skill: SkillInfo }> {
  return request(`/agents/${agentId}/skills/${encodeURIComponent(skillId)}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

export function deleteSkill(agentId: string, skillId: string): Promise<{ success: boolean }> {
  return request(`/agents/${agentId}/skills/${encodeURIComponent(skillId)}`, {
    method: 'DELETE',
  });
}

// ============================================================
// Tool 管理
// ============================================================

export interface ToolParamDef {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
}

export interface HttpHandler {
  type: 'http';
  url: string;
  method?: string;
  headers?: Record<string, string>;
  bodyTemplate?: string;
}

export interface ScriptHandler {
  type: 'script';
  scriptFile: string;
  runtime: 'node' | 'python' | 'bash';
  timeout?: number;
}

export type ToolHandler = HttpHandler | ScriptHandler;

export interface AgentToolConfig {
  id: string;
  name: string;
  description: string;
  parameters: ToolParamDef[];
  handler: ToolHandler;
  enabled?: boolean;
}

export function listTools(agentId: string): Promise<AgentToolConfig[]> {
  return request(`/agents/${agentId}/tools`);
}

export function createTool(
  agentId: string,
  tool: AgentToolConfig,
): Promise<{ success: boolean; tool: AgentToolConfig }> {
  return request(`/agents/${agentId}/tools`, {
    method: 'POST',
    body: JSON.stringify(tool),
  });
}

export function updateTool(
  agentId: string,
  toolId: string,
  fields: Partial<AgentToolConfig>,
): Promise<{ success: boolean; tool: AgentToolConfig }> {
  return request(`/agents/${agentId}/tools/${encodeURIComponent(toolId)}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

export function deleteTool(agentId: string, toolId: string): Promise<{ success: boolean }> {
  return request(`/agents/${agentId}/tools/${encodeURIComponent(toolId)}`, {
    method: 'DELETE',
  });
}

/**
 * 上传工具脚本文件
 */
export async function uploadToolScript(
  agentId: string,
  toolId: string,
  file: File,
): Promise<{ success: boolean; scriptFile: string; size: number; tool: AgentToolConfig }> {
  const form = new FormData();
  form.append('script', file);
  const resp = await fetch(
    `${BASE}/agents/${agentId}/tools/${encodeURIComponent(toolId)}/script`,
    { method: 'POST', body: form },
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: resp.statusText }));
    throw new Error(err.message || resp.statusText);
  }
  return resp.json();
}
