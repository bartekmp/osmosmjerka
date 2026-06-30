import { TextEncoder, TextDecoder } from 'util';

// Set up environment variables for tests
process.env.VITE_BASE_PATH = '/';
process.env.VITE_APP_VERSION = '0.0.0-test';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = jest.fn(() => 'mock-url');
  window.URL.revokeObjectURL = jest.fn();
}

// Mock window.matchMedia for responsive hooks (useMediaQuery). Evaluate
// min-width/max-width queries against a default desktop viewport so layout
// logic resolves to the desktop/sidebar layout in tests; pointer queries
// (e.g. any-pointer: coarse) resolve to false (non-touch).
const MOCK_VIEWPORT_WIDTH = 1024;
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => {
    let matches = false;
    const minWidth = query.match(/min-width:\s*([\d.]+)px/);
    const maxWidth = query.match(/max-width:\s*([\d.]+)px/);
    if (minWidth) matches = MOCK_VIEWPORT_WIDTH >= parseFloat(minWidth[1]);
    if (maxWidth) matches = MOCK_VIEWPORT_WIDTH <= parseFloat(maxWidth[1]);
    return {
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
  }),
});