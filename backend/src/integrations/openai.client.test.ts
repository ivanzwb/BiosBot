import { createOpenAIChat, OpenAIConfig } from '../integrations/openai.client';

describe('integrations/openai.client', () => {
  describe('createOpenAIChat', () => {
    it('should create chat model with required config', () => {
      const config: OpenAIConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
      };
      
      const result = createOpenAIChat(config);
      
      expect(result).toBeDefined();
    });

    it('should throw error if model is missing', () => {
      const config: OpenAIConfig = {
        apiKey: 'test-api-key',
        model: '',
      };
      
      expect(() => createOpenAIChat(config)).toThrow('未配置模型名称');
    });

    it('should handle model as object with model property', () => {
      const config: OpenAIConfig = {
        apiKey: 'test-api-key',
        model: { model: 'gpt-4' } as any,
      };
      
      const result = createOpenAIChat(config);
      
      expect(result).toBeDefined();
    });

    it('should handle model as object with id property', () => {
      const config: OpenAIConfig = {
        apiKey: 'test-api-key',
        model: { id: 'gpt-4' } as any,
      };
      
      const result = createOpenAIChat(config);
      
      expect(result).toBeDefined();
    });

    it('should pass temperature and maxTokens', () => {
      const config: OpenAIConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 1000,
      };
      
      const result = createOpenAIChat(config);
      
      expect(result).toBeDefined();
    });

    it('should handle baseUrl', () => {
      const config: OpenAIConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
        baseUrl: 'https://api.example.com/v1',
      };
      
      const result = createOpenAIChat(config);
      
      expect(result).toBeDefined();
    });
  });
});
