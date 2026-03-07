/**
 * Skill 技能类型定义
 *
 * 遵循 Agent Skills 标准 (https://agentskills.io/specification)。
 *
 * 每个 Skill 是一个独立目录，位于 Agent 的 skills/ 子目录下：
 *   skills/
 *   └── skill-name/
 *       ├── SKILL.md          # 必须 — YAML frontmatter + 正文内容
 *       ├── scripts/          # 可选 — 脚本文件
 *       ├── references/       # 可选 — 参考文档
 *       └── assets/           # 可选 — 资源文件（图片等）
 *
 * 向后兼容：仍支持旧格式 skills/<skill-id>.md 单文件。
 *
 * SKILL.md 格式：
 *   ---
 *   id: calculate-metrics
 *   name: 财务指标计算
 *   description: 根据财务数据计算 PE、PB、ROE 等常见指标
 *   license: MIT
 *   metadata:
 *     author: bios
 *     version: "1.0"
 *   allowed-tools: tool1 tool2
 *   ---
 *   （正文：Skill 的详细指令、知识内容、示例等，供 Agent 注入 prompt）
 */

/** Skill 附属文件信息 */
export interface SkillFile {
  /** 文件名 */
  name: string;
  /** 文件大小 (bytes) */
  size: number;
}

export interface Skill {
  /** Skill 唯一标识（与目录名对应，如 "calculate-metrics"） */
  id: string;
  /** Skill 显示名称 */
  name: string;
  /** Skill 功能描述（供路由决策和 UI 展示） */
  description: string;
  /** Skill 正文内容（SKILL.md 的 Markdown 正文），Agent 按需注入到 LLM prompt 中 */
  content: string;
  /** 许可证 */
  license?: string;
  /** 元数据（作者、版本等） */
  metadata?: Record<string, string>;
  /** 允许使用的工具列表（空格分隔字符串或数组） */
  allowedTools?: string[];
  /** scripts/ 目录下的文件列表 */
  scripts?: SkillFile[];
  /** references/ 目录下的文件列表 */
  references?: SkillFile[];
  /** assets/ 目录下的文件列表 */
  assets?: SkillFile[];
}

