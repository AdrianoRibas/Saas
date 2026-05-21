// Test setup file

// Increase timeout for tests
jest.setTimeout(30000);

// Global test utilities
export const testUtils = {
    // Generate random email for testing
    randomEmail: () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,

    // Generate random string
    randomString: (length = 10) => Math.random().toString(36).slice(2, 2 + length),
};
