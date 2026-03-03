/**
 * Agent & 模型默认映射种子配置。
 * 仅在数据库中尚无 agent_model_mapping 配置时，作为初始值写入。
 * 运行时以数据库为唯一真源。
 */
export const defaultAgentModelMapping = {
  defaultModel: {
    provider: 'openai',
    model: 'gpt-4.1-mini',
  },
  agents: {
    'proxy-agent': {
      enabled: true,
      model: { provider: 'openai', model: 'gpt-4.1-mini' },
    },
    'stock-agent': {
      enabled: true,
      model: { provider: 'openai', model: 'gpt-4.1-mini' },
    },
    'teacher-agent': {
      enabled: true,
      model: { provider: 'openai', model: 'gpt-4.1-mini' },
    },
    'novel-agent': {
      enabled: false,
      model: { provider: 'openai', model: 'gpt-4.1' },
    },
    'movie-agent': {
      enabled: false,
      model: { provider: 'openai', model: 'gpt-4.1' },
    },
  },
};
