/**
 * app.ts — Express 应用配置
 *
 * 挂载中间件 + 路由，导出 app 实例供 index.ts 启动。
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRoutes from './routes';
import { loggerMiddleware } from './middlewares/logger.middleware';
import { errorMiddleware } from './middlewares/error.middleware';
import { rateLimitMiddleware } from './middlewares/rate-limit.middleware';

const app = express();

// ---------- 全局中间件 ----------

// 安全头
app.use(helmet());

// CORS（开发阶段放开所有源）
app.use(cors());

// Body 解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use(loggerMiddleware);

// 基础速率限制
app.use(rateLimitMiddleware());

// ---------- API 路由 ----------

app.use('/api', apiRoutes);

// ---------- 全局错误处理 ----------

app.use(errorMiddleware);

export default app;
