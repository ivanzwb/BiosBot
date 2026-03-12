/**
 * skill-loader.ts — Skill 自动发现与加载
 *
 * 遵循 Agent Skills 标准 (https://agentskills.io/specification)。
 *
 * 支持两种格式：
 *  1. 目录格式（标准）: skills/<skill-name>/SKILL.md  (+scripts/, references/, assets/)
 *  2. 单文件格式（向后兼容）: skills/<skill-name>.md
 *
 * SKILL.md / .md 文件以 YAML frontmatter 开头（--- ... ---），包含 id、name、description 等。
 * frontmatter 之后的所有内容即为 Skill 正文（content），供 Agent 注入 prompt。
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Skill, SkillFile } from '../types/skill.types';
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
 * 列出子目录中的文件信息。
 */
async function listSubdirFiles(dir: string): Promise<SkillFile[]> {
  try {
    const exists = await fs.access(dir).then(() => true).catch(() => false);
    if (!exists) return [];
    
    const files = await fs.readdir(dir);
    const result: SkillFile[] = [];
    
    for (const f of files) {
      const full = path.join(dir, f);
      const stat = await fs.stat(full);
      if (stat.isFile()) {
        result.push({ name: f, size: stat.size });
      }
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * 从一个 Skill 目录加载（标准格式：目录下包含 SKILL.md）。
 */
async function loadSkillFromDir(skillDir: string, dirName: string): Promise<Skill | null> {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  
  try {
    const exists = await fs.access(skillMdPath).then(() => true).catch(() => false);
    if (!exists) return null;

    const raw = await fs.readFile(skillMdPath, 'utf-8');
    const { meta, content } = parseFrontmatter(raw);

    const id = meta.id || dirName;
    const name = meta.name || id;
    const description = meta.description || '';

    if (!content) {
      logger.warn(`skill-loader: "${dirName}/SKILL.md" has no content, skipped`);
      return null;
    }

    // 解析可选字段
    const license = meta.license || undefined;
    const allowedTools = meta['allowed-tools']
      ? meta['allowed-tools'].split(/\s+/).filter(Boolean)
      : undefined;

    // 解析 metadata (简单的 key: value)
    let metadata: Record<string, string> | undefined;
    if (meta['metadata']) {
      metadata = { value: meta['metadata'] };
    }
    // 支持 metadata.author / metadata.version 等
    for (const key of Object.keys(meta)) {
      if (key.startsWith('metadata.')) {
        if (!metadata) metadata = {};
        metadata[key.slice(9)] = meta[key];
      }
    }

    // 并行加载 scripts, references, assets 目录
    const [scripts, references, assets] = await Promise.all([
      listSubdirFiles(path.join(skillDir, 'scripts')),
      listSubdirFiles(path.join(skillDir, 'references')),
      listSubdirFiles(path.join(skillDir, 'assets')),
    ]);

    const skill: Skill = {
      id, name, description, content,
      ...(license ? { license } : {}),
      ...(metadata ? { metadata } : {}),
      ...(allowedTools ? { allowedTools } : {}),
      scripts,
      references,
      assets,
    };

    logger.debug(`skill-loader: loaded skill "${id}" from dir "${skillDir}"`);
    return skill;
  } catch (err) {
    logger.warn(`skill-loader: failed to load SKILL.md in "${skillDir}"`, { error: err });
    return null;
  }
}

/**
 * 从单个 .md 文件加载 Skill（向后兼容旧格式）。
 */
async function loadSkillFromFile(filePath: string, fileName: string): Promise<Skill | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const { meta, content } = parseFrontmatter(raw);

    const defaultId = fileName.replace(/\.md$/, '');
    const id = meta.id || defaultId;
    const name = meta.name || id;
    const description = meta.description || '';

    if (!content) {
      logger.warn(`skill-loader: "${fileName}" has no content, skipped`);
      return null;
    }

    return { id, name, description, content };
  } catch (err) {
    logger.warn(`skill-loader: failed to load "${fileName}"`, { error: err });
    return null;
  }
}

/**
 * 从指定的 Agent 目录加载 skills/ 子目录中的所有 Skill。
 *
 * 优先识别目录格式（skill-name/SKILL.md），回退到旧的单文件格式（skill-name.md）。
 *
 * @param agentDir  Agent 根目录（如 agents/stock-agent）
 * @returns 已加载的 Skill 数组
 */
export async function loadSkills(agentDir: string): Promise<Skill[]> {
  const skillsDir = path.join(agentDir, 'skills');
  const loaded: Skill[] = [];

  try {
    const exists = await fs.access(skillsDir).then(() => true).catch(() => false);
    if (!exists) {
      return loaded;
    }
  } catch (err) {
    logger.error(`skill-loader: failed to read skills dir "${skillsDir}"`, { error: err });
    return loaded;
  }

  let entries: string[];
  try {
    entries = await fs.readdir(skillsDir);
  } catch (err) {
    logger.error(`skill-loader: failed to read skills dir "${skillsDir}"`, { error: err });
    return loaded;
  }

  // 使用 Promise.all 并行加载所有 Skill
  const loadPromises = entries.map(async (entry) => {
    const fullPath = path.join(skillsDir, entry);

    try {
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        // 标准目录格式：skill-name/SKILL.md
        const skill = await loadSkillFromDir(fullPath, entry);
        if (skill) loaded.push(skill);
      } else if (entry.endsWith('.md') && stat.isFile()) {
        // 向后兼容：单个 .md 文件
        const skill = await loadSkillFromFile(fullPath, entry);
        if (skill) loaded.push(skill);
      }
    } catch (err) {
      logger.warn(`skill-loader: failed to process "${entry}" in "${skillsDir}"`, { error: err });
    }
  });

  await Promise.all(loadPromises);
  return loaded;
}

/**
 * 在一组已加载的 Skill 中按 id 查找。
 */
export function findSkill(skills: Skill[], skillId: string): Skill | undefined {
  return skills.find((s) => s.id === skillId);
}
