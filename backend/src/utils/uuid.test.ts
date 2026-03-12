import { generateId, nowISO } from '../utils/uuid';

describe('utils/uuid', () => {
  describe('generateId', () => {
    it('should generate a valid UUID v4', () => {
      const id = generateId();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('nowISO', () => {
    it('should return ISO 8601 formatted string', () => {
      const now = nowISO();
      const date = new Date(now);
      expect(date.getTime()).not.toBeNaN();
    });

    it('should return current time', () => {
      const before = new Date().toISOString();
      const now = nowISO();
      const after = new Date().toISOString();
      expect(now >= before).toBe(true);
      expect(now <= after).toBe(true);
    });
  });
});
