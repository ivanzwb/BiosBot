/**
 * chat.routes.ts — 对话/消息 CRUD 路由
 */

import { Router } from 'express';
import * as ChatCtrl from '../controllers/chat.controller';

const router = Router();

// GET  /api/conversations
router.get('/', ChatCtrl.listConversations);

// POST /api/conversations
router.post('/', ChatCtrl.createConversation);

// GET  /api/conversations/:id
router.get('/:id', ChatCtrl.getConversation);

// PUT  /api/conversations/:id
router.put('/:id', ChatCtrl.updateConversation);

// DELETE /api/conversations/:id
router.delete('/:id', ChatCtrl.deleteConversation);

// GET  /api/conversations/:id/messages
router.get('/:id/messages', ChatCtrl.listMessages);

// POST /api/conversations/:id/generate-title
router.post('/:id/generate-title', ChatCtrl.generateTitle);

export default router;
