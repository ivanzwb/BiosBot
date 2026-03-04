/**
 * chat.controller.ts — 对话/消息 CRUD 控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as ChatService from '../services/chat.service';
import { CreateConversationRequest } from '../types/api.types';
import { resolveModelConfig } from '../agents/base-agent';
import { createChatModel } from '../integrations/llm.factory';
import { HumanMessage } from '@langchain/core/messages';
import logger from '../infra/logger/logger';

/**
 * GET /api/conversations
 */
export function listConversations(_req: Request, res: Response, next: NextFunction): void {
  try {
    const conversations = ChatService.listConversations();
    res.json(conversations);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/conversations
 */
export function createConversation(req: Request, res: Response, next: NextFunction): void {
  try {
    const { title } = req.body as CreateConversationRequest;
    const conversation = ChatService.createConversation(title);
    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/conversations/:id
 */
export function getConversation(req: Request, res: Response, next: NextFunction): void {
  try {
    const conversation = ChatService.getConversation(req.params.id as string);
    if (!conversation) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Conversation not found' });
      return;
    }
    res.json(conversation);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/conversations/:id
 */
export function updateConversation(req: Request, res: Response, next: NextFunction): void {
  try {
    const { title, status } = req.body;
    ChatService.updateConversation(req.params.id as string, { title, status });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/conversations/:id
 */
export function deleteConversation(req: Request, res: Response, next: NextFunction): void {
  try {
    ChatService.deleteConversation(req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/conversations/:id/messages
 */
export function listMessages(req: Request, res: Response, next: NextFunction): void {
  try {
    const messages = ChatService.listMessages(req.params.id as string);
    res.json(messages);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/conversations/:id/generate-title
 *
 * 根据对话内容自动生成简短标题（≤20字），更新到数据库并返回。
 */
export async function generateTitle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const conversation = ChatService.getConversation(id);
    if (!conversation) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Conversation not found' });
      return;
    }

    // 只在标题仍是默认值时才生成
    if (conversation.title && conversation.title !== '新对话') {
      res.json({ title: conversation.title });
      return;
    }

    const messages = ChatService.listMessages(id);
    if (messages.length === 0) {
      res.json({ title: conversation.title });
      return;
    }

    // 取前6条消息作为摘要素材
    const snippet = messages
      .slice(0, 6)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')
      .slice(0, 1000);

    const modelCfg = resolveModelConfig('proxy-agent');
    const llm = createChatModel({
      apiKey: modelCfg.apiKey,
      baseUrl: modelCfg.baseUrl,
      model: modelCfg.model,
      maxTokens: 30,
      temperature: 0,
    });

    const result = await llm.invoke([
      new HumanMessage(
        `请用不超过15个中文字（或20个英文字符）为以下对话生成一个简短标题，只返回标题文本，不要引号不要标点：\n\n${snippet}`
      ),
    ]);

    let title = (typeof result.content === 'string' ? result.content : '').trim();
    // 去除可能的引号
    title = title.replace(/^["'""'']+|["'""'']+$/g, '').trim();
    // 硬截断到20字符
    if (title.length > 20) title = title.slice(0, 20);
    if (!title) title = conversation.title;

    ChatService.updateConversation(id, { title });
    logger.info('chat.controller: generated title', { conversationId: id, title });
    res.json({ title });
  } catch (err) {
    logger.error('chat.controller: generateTitle error', { error: err });
    // 标题生成失败不应影响用户体验，返回当前标题
    try {
      const conversation = ChatService.getConversation(req.params.id as string);
      res.json({ title: conversation?.title || '新对话' });
    } catch {
      next(err);
    }
  }
}
