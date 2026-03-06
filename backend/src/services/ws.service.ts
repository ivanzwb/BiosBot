/**
 * ws.service.ts — WebSocket 服务
 *
 * 提供实时消息推送能力：
 *  - 任务状态变更通知（task:update）
 *  - 新消息通知（message:new）
 *  - 知识库导入进度（ingest:progress）
 *
 * 前端通过 ws://host:port/ws 连接。
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import logger from '../infra/logger/logger';

let wss: WebSocketServer | null = null;

export interface WsEvent {
  type: string;
  payload: unknown;
}

/**
 * 初始化 WebSocket 服务，附加到现有 HTTP Server。
 */
export function initWebSocket(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    logger.debug('ws.service: client connected');

    ws.on('close', () => {
      logger.debug('ws.service: client disconnected');
    });

    ws.on('error', (err) => {
      logger.error('ws.service: client error', { error: err });
    });
  });

  logger.info('ws.service: WebSocket server initialized at /ws');
  return wss;
}

/**
 * 向所有已连接的客户端广播事件。
 */
export function broadcast(event: WsEvent): void {
  if (!wss) return;
  const data = JSON.stringify(event);
  logger.debug('ws.service: broadcasting event', { type: event.type, clientCount: wss.clients.size });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

/**
 * 便捷方法：广播任务状态变更
 */
export function broadcastTaskUpdate(taskId: string, status: string, result?: unknown, error?: string): void {
  broadcast({
    type: 'task:update',
    payload: { taskId, status, result, error },
  });
}

/**
 * 便捷方法：广播新消息
 */
export function broadcastNewMessage(conversationId: string, message: unknown): void {
  broadcast({
    type: 'message:new',
    payload: { conversationId, message },
  });
}

/**
 * 执行步骤类型
 */
export type StepType =
  | 'classify'        // 意图识别
  | 'route'           // 路由规划
  | 'agent_start'     // 开始调用领域Agent
  | 'agent_end'       // 领域Agent完成
  | 'tool_call'       // 工具调用
  | 'aggregate'       // 聚合结果
  | 'direct_answer';  // 直接回答

export interface ExecutionStep {
  stepType: StepType;
  agentId?: string;
  agentName?: string;
  description: string;
  status: 'running' | 'completed' | 'failed';
  detail?: unknown;
}

/**
 * 便捷方法：广播执行步骤
 */
export function broadcastExecutionStep(
  conversationId: string,
  taskId: string,
  step: ExecutionStep
): void {
  logger.info('ws.service: broadcasting step:update', { conversationId, taskId, stepType: step.stepType, status: step.status, agentId: step.agentId });
  broadcast({
    type: 'step:update',
    payload: { conversationId, taskId, step },
  });
}
