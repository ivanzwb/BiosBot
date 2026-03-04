/**
 * ws.ts — WebSocket 客户端
 *
 * 提供自动重连的 WebSocket 连接，支持事件监听。
 */

export interface WsEvent {
  type: string;
  payload: any;
}

type WsListener = (event: WsEvent) => void;

let ws: WebSocket | null = null;
let listeners: WsListener[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function getWsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  // 开发模式下连接后端端口 3000
  const host = location.hostname;
  const port = import.meta.env.DEV ? '3000' : location.port;
  return `${proto}//${host}:${port}/ws`;
}

function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    ws = new WebSocket(getWsUrl());

    ws.onopen = () => {
      console.log('[ws] connected');
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (evt) => {
      try {
        const event: WsEvent = JSON.parse(evt.data);
        listeners.forEach((fn) => fn(event));
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      console.log('[ws] disconnected, reconnecting in 3s...');
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

/**
 * 注册 WebSocket 事件监听器。
 * 首次调用时自动建立连接。
 * 返回取消监听的函数。
 */
export function onWsEvent(listener: WsListener): () => void {
  listeners.push(listener);
  // 首次注册时自动连接
  if (!ws) connect();
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * 监听特定类型的 WebSocket 事件。
 */
export function onWsEventType(type: string, listener: (payload: any) => void): () => void {
  return onWsEvent((event) => {
    if (event.type === type) {
      listener(event.payload);
    }
  });
}
