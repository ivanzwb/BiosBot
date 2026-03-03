/**
 * admin.routes.ts — 运维、监控、配置管理路由
 */

import { Router, Request, Response, NextFunction } from 'express';
import { listConfigs, getConfig, upsertConfig } from '../models/config.model';
import * as TaskService from '../services/task.service';
import { UpdateConfigRequest } from '../types/api.types';

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

export default router;
