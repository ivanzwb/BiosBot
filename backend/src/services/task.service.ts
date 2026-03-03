/**
 * task.service.ts — 任务生命周期管理
 *
 * 负责创建、轮询、更新任务状态，支持长任务心跳检测与恢复。
 */

import * as TaskModel from '../models/task.model';
import { TaskRecord } from '../types/db.types';
import logger from '../infra/logger/logger';

export function createTask(
  type: TaskRecord['type'],
  payload: unknown,
  conversationId?: string
): TaskRecord {
  const task = TaskModel.createTask(type, payload, conversationId);
  logger.info('task.service: created task', { id: task.id, type });
  return task;
}

export function getTask(id: string): TaskRecord | undefined {
  return TaskModel.getTask(id);
}

export function listTasks(status?: TaskRecord['status']): TaskRecord[] {
  return TaskModel.listTasks(status);
}

export function succeedTask(id: string, result: unknown): void {
  TaskModel.updateTask(id, {
    status: 'succeeded',
    result: JSON.stringify(result),
    progress: 100,
  });
  logger.info('task.service: task succeeded', { id });
}

export function failTask(id: string, error: string): void {
  TaskModel.updateTask(id, { status: 'failed', error });
  logger.error('task.service: task failed', { id, error });
}

export function updateTaskProgress(id: string, progress: number): void {
  TaskModel.updateTask(id, { progress });
}

export function cancelTask(id: string): void {
  TaskModel.updateTask(id, { status: 'canceled' });
  logger.info('task.service: task canceled', { id });
}

export function heartbeat(id: string): void {
  TaskModel.heartbeatTask(id);
}

/**
 * 检测假死任务：last_heartbeat_at 超过阈值的 running 任务标记为 failed
 */
export function detectStaleTasks(thresholdMs: number = 5 * 60 * 1000): void {
  const runningTasks = TaskModel.listTasks('running');
  const now = Date.now();

  for (const task of runningTasks) {
    const lastBeat = task.last_heartbeat_at
      ? new Date(task.last_heartbeat_at).getTime()
      : new Date(task.updated_at).getTime();

    if (now - lastBeat > thresholdMs) {
      logger.warn('task.service: stale task detected', { id: task.id });
      failTask(task.id, 'Task heartbeat timeout — marked as failed');
    }
  }
}
