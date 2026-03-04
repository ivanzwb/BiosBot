/**
 * admin.routes.ts — 运维、监控、配置管理路由
 */

import { Router, Request, Response, NextFunction } from 'express';
import { listConfigs, getConfig, upsertConfig } from '../models/config.model';
import * as TaskService from '../services/task.service';
import { UpdateConfigRequest } from '../types/api.types';
import { createOpenAIChat } from '../integrations/openai.client';
import { HumanMessage } from '@langchain/core/messages';
import logger from '../infra/logger/logger';

const router = Router();

// GET /api/admin/configs — 读取所有系统配置
router.get('/configs', (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(listConfigs());
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/configs/:key — 读取单个配置
router.get('/configs/:key', (req: Request, res: Response, next: NextFunction) => {
  try {
    const cfg = getConfig(req.params.key as string);
    if (!cfg) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Config not found' });
      return;
    }
    res.json(cfg);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/configs/:key — 修改系统配置
router.put('/configs/:key', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { value, scope } = req.body as UpdateConfigRequest;
    if (value === undefined) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'value is required' });
      return;
    }
    upsertConfig(req.params.key as string, value, scope);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks — 获取任务列表
router.get('/tasks', (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const tasks = TaskService.listTasks(status as any);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id — 获取单个任务状态
router.get('/tasks/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = TaskService.getTask(req.params.id as string);
    if (!task) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Task not found' });
      return;
    }
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/test-model — 测试模型连通性（结果持久化到 DB）
router.post('/test-model', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modelId, model, apiKey, baseUrl } = req.body as {
      modelId?: string; model?: string; apiKey?: string; baseUrl?: string;
    };
    if (!model || !apiKey) {
      res.status(400).json({ success: false, message: '模型名称和 API Key 不能为空' });
      return;
    }

    let testEntry: {
      success: boolean;
      latency?: number;
      reply?: string;
      message?: string;
      testedAt: string;
    };

    try {
      const startTime = Date.now();
      const llm = createOpenAIChat({ model, apiKey, baseUrl, maxTokens: 20, temperature: 0 });
      const result = await llm.invoke([new HumanMessage('Hi, reply with "ok" only.')]);
      const latency = Date.now() - startTime;
      const content = typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content);

      logger.info('admin.test-model: success', { model, latency });
      testEntry = { success: true, latency, reply: content.slice(0, 100), testedAt: new Date().toISOString() };
    } catch (err: any) {
      logger.warn('admin.test-model: failed', { error: err?.message || String(err) });
      testEntry = { success: false, message: err?.message || String(err), testedAt: new Date().toISOString() };
    }

    // 持久化测试结果到 DB（按 modelId 存储）
    if (modelId) {
      try {
        const existing = getConfig('model_test_results');
        const map: Record<string, typeof testEntry> = existing ? JSON.parse(existing.value) : {};
        map[modelId] = testEntry;
        upsertConfig('model_test_results', JSON.stringify(map));
      } catch (e) {
        logger.warn('admin.test-model: failed to persist result', { error: e });
      }
    }

    res.json(testEntry);
  } catch (err) {
    next(err);
  }
});

export default router;
