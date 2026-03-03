/**
 * Skill 技能类型定义
 *
 * Skill 是 Agent 内部可复用的原子能力 / 知识单元，以 Markdown 文件定义。
 * 每个 Skill 文件位于 Agent 的 skills/ 子目录下（*.md），
 * 由 skill-loader 自动扫描加载，Agent 在 run() 中按需将其内容注入 LLM 上下文。
 *
 * Markdown 文件格式：
 *   ---
 *   id: calculate-metrics
 *   name: 财务指标计算
 *   description: 根据财务数据计算 PE、PB、ROE 等常见指标
 *   ---
 *   （正文：Skill 的详细指令、知识内容、示例等，供 Agent 注入 prompt）
 */

export interface Skill {
  /** Skill 唯一标识（与文件名对应，如 "calculate-metrics"） */
  id: string;
  /** Skill 显示名称 */
  name: string;
  /** Skill 功能描述（供路由决策和 UI 展示） */
  description: string;
  /** Skill 正文内容（Markdown），Agent 按需注入到 LLM prompt 中 */
  content: string;
}

