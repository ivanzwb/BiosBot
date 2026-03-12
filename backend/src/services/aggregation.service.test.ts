import { aggregateOutputs } from '../services/aggregation.service';

describe('services/aggregation.service', () => {
  describe('aggregateOutputs', () => {
    it('should return default answer for empty outputs', () => {
      const result = aggregateOutputs([]);
      
      expect(result).toHaveProperty('answer', '未获取到任何 Agent 的回答。');
      expect(result.sources).toEqual([]);
    });

    it('should handle single agent output', () => {
      const outputs = [
        {
          agentId: 'agent-1',
          output: { answer: 'The answer is 42', reasoning: 'Based on calculations' },
        },
      ];
      
      const result = aggregateOutputs(outputs as any);
      
      expect(result.answer).toBe('The answer is 42');
      expect(result.reasoning).toBe('Based on calculations');
      expect(result.sources).toHaveLength(1);
    });

    it('should handle multiple agent outputs', () => {
      const outputs = [
        {
          agentId: 'agent-1',
          output: { answer: 'Answer from agent 1' },
        },
        {
          agentId: 'agent-2',
          output: { answer: 'Answer from agent 2' },
        },
      ];
      
      const result = aggregateOutputs(outputs as any);
      
      expect(result.answer).toContain('**[agent-1]**');
      expect(result.answer).toContain('**[agent-2]**');
      expect(result.sources).toHaveLength(2);
    });
  });
});
