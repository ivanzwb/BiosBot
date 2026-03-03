/**
 * skill-loader.ts — Skill 自动发现与加载（Markdown 格式）
 *
 * 扫描指定目录下的 skills/ 子目录，读取每个 .md 文件并解析 YAML frontmatter + 正文内容。
 *
 * 约定：
 *  - Skill 文件位于 <agent-dir>/skills/<skill-name>.md
 *  - 文件以 YAML frontmatter 开头（--- ... ---），包含 id、name、description
 *  - frontmatter 之后的所有内容即为 Skill 正文（content），供 Agent 注入 prompt
 *  - 文件名（去掉 .md）作为默认 id
 */

import * as fs from 'fs';
import * as path from 'path';
import { Skill } from '../types/skill.types';
import logger from '../infra/logger/logger';

/**
 * 简单的 YAML frontmatter 解析器。
 * 解析 `--- ... ---` 之间的 key: value 键值对（单层、纯字符串值）。
 * 返回 { meta, content }。
 */
function parseFrontmatter(raw: string): { meta: Record<string, string>; content: string } {
  const meta: Record<string, string> = {};
  let content = raw;

  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (match) {
    const yamlBlock = match[1];
    content = match[2].trim();

    for (const line of yamlBlock.split(/\r?\n/)) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        meta[key] = val;
      }
    }
  }

  return { meta, content };
}

/**
 * 从指定的 Agent 目录加载 skills/ 子目录中的所有 Skill（.md 文件）。
 *
 * @param agentDir  Agent 根目录（如 agents/stock-agent）
 * @returns 已加载的 Skill 数组
 */
export function loadSkills(agentDir: string): Skill[] {
  const skillsDir = path.join(agentDir, 'skills');
  const loaded: Skill[] = [];

  if (!fs.existsSync(skillsDir)) {
    return loaded;
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(skillsDir);
  } catch (err) {
    logger.error(`skill-loader: failed to read skills dir "${skillsDir}"`, { error: err });
    return loaded;
  }

  for (const entry of entries) {
    // 只处理 .md 文件
    if (!entry.endsWith('.md')) continue;

    const filePath = path.join(skillsDir, entry);

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { meta, content } = parseFrontmatter(raw);

      const defaultId = entry.replace(/\.md$/, '');
      const id = meta.id || defaultId;
      const name = meta.name || id;
      const description = meta.description || '';

      if (!content) {
        logger.warn(`skill-loader: "${entry}" in "${skillsDir}" has no content, skipped`);
        continue;
      }

      loaded.push({ id, name, description, content });
      logger.debug(`skill-loader: loaded skill "${id}" from "${filePath}"`);
    } catch (err) {
      logger.warn(`skill-loader: failed to load "${entry}" in "${skillsDir}"`, { error: err });
    }
  }

  return loaded;
}

/**
 * 在一组已加载的 Skill 中按 id 查找。
 */
export function findSkill(skills: Skill[], skillId: string): Skill | undefined {
  return skills.find((s) => s.id === skillId);
}
