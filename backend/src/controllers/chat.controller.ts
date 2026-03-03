/**
 * chat.controller.ts — 对话/消息 CRUD 控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as ChatService from '../services/chat.service';
import { CreateConversationRequest } from '../types/api.types';

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
