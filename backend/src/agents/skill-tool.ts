/**
 * skill-tool.ts — 将 Skill 暴露为 LangChain Tool，供 LLM 按需调用
 *
 * 遵循 OpenSkill 标准：
 *  - Skill 元数据（id, name, description）预加载，嵌入 system prompt
 *  - Skill 内容（content）作为 tool 暴露，LLM 通过 tool call 按需加载
 *
 * 使用方式：
 *  1. buildSkillCatalog(skills) → 生成嵌入 prompt 的元数据摘要
 *  2. createSkillTools(skills) → 生成 LangChain Tool 数组，绑定到 ChatModel
 *  3. invokeWithSkills(chat, skills, messages) → 封装完整的 tool-calling 循环
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Skill } from '../types/skill.types';
import logger from '../infra/logger/logger';

/**
 * 构建 Skill 目录摘要文本（仅元数据），嵌入 system prompt。
 * 让 LLM 知道有哪些 Skill 可用，以便决策是否调用 use_skill 工具。
 */
export function buildSkillCatalog(skills: Skill[]): string {
  if (skills.length === 0) return '';
  const list = skills
    .map((s) => `- **${s.name}** (id: \`${s.id}\`): ${s.description}`)
    .join('\n');
  return `你拥有以下可用技能（Skill），可通过 use_skill 工具按需调用：\n${list}\n\n当你认为某个技能有助于更好地回答用户问题时，请调用 use_skill 工具加载该技能的详细指引，然后结合指引内容完成回答。`;
}

/**
 * 将一组 Skill 包装为 LangChain Tool 数组 — 一个 use_skill 工具。
 * LLM 通过 tool call 传入 skill_id，获取对应 Skill 的完整内容。
 */
export function createSkillTools(skills: Skill[]): DynamicStructuredTool[] {
  if (skills.length === 0) return [];

  const skillMap = new Map(skills.map((s) => [s.id, s]));
  const validIds = skills.map((s) => s.id);

  const skillSchema = z.object({
    skill_id: z.string().describe('要加载的技能 ID'),
  });

  const tool = new DynamicStructuredTool({
    name: 'use_skill',
    description:
      '加载指定技能（Skill）的详细内容。传入 skill_id 获取该技能的完整指引和知识，用于辅助回答用户问题。可用的 skill_id: ' +
      validIds.join(', '),
    schema: skillSchema as any,
    func: async ({ skill_id }: { skill_id: string }) => {
      const skill = skillMap.get(skill_id);
      if (!skill) {
        logger.warn(`use_skill tool: skill "${skill_id}" not found`);
        return `技能 "${skill_id}" 不存在。可用的技能: ${validIds.join(', ')}`;
      }
      logger.debug(`use_skill tool: loaded skill "${skill_id}"`);
      return skill.content;
    },
  });

  return [tool];
}
