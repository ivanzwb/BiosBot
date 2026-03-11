import { defaultAgentModelMapping } from '../config/agents.config';

describe('config/agents.config', () => {
  describe('defaultAgentModelMapping', () => {
    it('should have defaultModel as string', () => {
      expect(typeof defaultAgentModelMapping.defaultModel).toBe('string');
    });

    it('should have agents object', () => {
      expect(typeof defaultAgentModelMapping.agents).toBe('object');
    });

    it('should have proxy-agent with enabled true', () => {
      expect(defaultAgentModelMapping.agents['proxy-agent']).toEqual({
        enabled: true,
        model: '',
      });
    });

    it('should have stock-agent with enabled true', () => {
      expect(defaultAgentModelMapping.agents['stock-agent']).toEqual({
        enabled: true,
        model: '',
      });
    });

    it('should have some agents disabled', () => {
      expect(defaultAgentModelMapping.agents['novel-agent'].enabled).toBe(false);
      expect(defaultAgentModelMapping.agents['movie-agent'].enabled).toBe(false);
    });
  });
});
