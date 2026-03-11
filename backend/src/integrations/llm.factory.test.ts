import { createChatModel, LLMFactoryConfig } from '../integrations/llm.factory';

describe('integrations/llm.factory', () => {
  describe('createChatModel', () => {
    it('should create chat model with config', () => {
      const config: LLMFactoryConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
      };
      
      const result = createChatModel(config);
      
      expect(result).toBeDefined();
    });

    it('should pass all config options', () => {
      const config: LLMFactoryConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
        baseUrl: 'https://api.example.com/v1',
        temperature: 0.7,
        maxTokens: 2000,
      };
      
      const result = createChatModel(config);
      
      expect(result).toBeDefined();
    });
  });
});
