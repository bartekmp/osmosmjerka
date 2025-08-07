import { TextEncoder, TextDecoder } from 'util';

// Set up environment variables for tests
process.env.VITE_BASE_PATH = '/';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = jest.fn(() => 'mock-url');
  window.URL.revokeObjectURL = jest.fn();
  // Mock navigation methods to suppress jsdom navigation warnings
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      assign: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
    },
  });
}