/**
 * Agent & 模型默认映射种子配置。
 * 仅在数据库中尚无 agent_model_mapping 配置时，作为初始值写入。
 * 运行时以数据库为唯一真源。
 *
 * 所有模型均走 OpenAI-compatible API，通过 api_url 指向不同端点。
 * defaultModel: 全局默认模型名称
 * agents[id].model: Agent 专属模型名称（留空则用 defaultModel）
 * agents[id].enabled: 是否启用
 */
export const defaultAgentModelMapping = {
  defaultModel: '',
  agents: {
    'proxy-agent': {
      enabled: true,
      model: '',
    },
    'stock-agent': {
      enabled: true,
      model: '',
    },
    'teacher-agent': {
      enabled: true,
      model: '',
    },
    'novel-agent': {
      enabled: false,
      model: '',
    },
    'movie-agent': {
      enabled: false,
      model: '',
    },
  },
};
