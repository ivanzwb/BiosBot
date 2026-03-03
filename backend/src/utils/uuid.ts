import { randomUUID } from 'crypto';

/** 生成 UUID v4 */
export function generateId(): string {
  return randomUUID();
}

/** 当前 ISO 8601 时间戳 */
export function nowISO(): string {
  return new Date().toISOString();
}
