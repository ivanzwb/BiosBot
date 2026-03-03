/**
 * chat.service.ts — 对话/消息 CRUD 编排
 *
 * 在 model 层之上提供业务级操作，例如：
 * - 创建对话 + 首条消息
 * - 发送消息 + 触发 Agent 调用
 * - 级联删除
 */

import * as ConversationModel from '../models/conversation.model';
import * as MessageModel from '../models/message.model';
import { ConversationRecord, MessageRecord } from '../types/db.types';

// ---------- Conversations ----------

export function createConversation(title?: string): ConversationRecord {
  return ConversationModel.createConversation(title);
}

export function listConversations(): ConversationRecord[] {
  return ConversationModel.listConversations();
}

export function getConversation(id: string): ConversationRecord | undefined {
  return ConversationModel.getConversation(id);
}

export function updateConversation(
  id: string,
  fields: Partial<Pick<ConversationRecord, 'title' | 'status'>>
): void {
  ConversationModel.updateConversation(id, fields);
}

export function deleteConversation(id: string): void {
  // 级联删除：先删消息，再删对话
  MessageModel.deleteMessagesByConversation(id);
  ConversationModel.deleteConversation(id);
}

// ---------- Messages ----------

export function addMessage(
  conversationId: string,
  role: MessageRecord['role'],
  content: string,
  agentId?: string
): MessageRecord {
  // 同步更新对话的 updated_at
  ConversationModel.updateConversation(conversationId, {});
  return MessageModel.createMessage(conversationId, role, content, agentId);
}

export function listMessages(conversationId: string): MessageRecord[] {
  return MessageModel.listMessages(conversationId);
}
