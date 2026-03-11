// Mock sqlite client
const mockDb = {
  prepare: () => ({
    run: () => ({ changes: 1 }),
    get: () => undefined,
    all: () => [],
  }),
  pragma: () => {},
  close: () => {},
};

const mockGetDb = () => mockDb;
const mockCloseDb = () => {};

// Re-export for use in tests
export { mockGetDb, mockCloseDb };
