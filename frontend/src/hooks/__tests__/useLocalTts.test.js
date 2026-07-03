import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock(
  '@mintplex-labs/piper-tts-web',
  () => ({
    __esModule: true,
    voices: jest.fn(),
    stored: jest.fn(),
    download: jest.fn(),
    remove: jest.fn(),
    predict: jest.fn(),
  }),
  { virtual: true }
);

import * as engine from '@mintplex-labs/piper-tts-web';
import { useLocalTts } from '../useLocalTts';

describe('useLocalTts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // jsdom may lack navigator.storage; the hook feature-detects on it
    Object.defineProperty(navigator, 'storage', { value: {}, configurable: true });
    engine.voices.mockResolvedValue(['pl_PL-gosia-medium', 'pl_PL-darkman-low', 'hr_HR-x-medium']);
    engine.stored.mockResolvedValue([]);
    engine.download.mockResolvedValue(undefined);
    engine.remove.mockResolvedValue(undefined);
  });

  test('lists installable voices for the language, none installed yet', async () => {
    const { result } = renderHook(() => useLocalTts('pl-PL'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.available).toEqual(['pl_PL-gosia-medium', 'pl_PL-darkman-low']);
    expect(result.current.hasVoice).toBe(false);
    expect(result.current.preferredVoice).toBeNull();
  });

  test('download updates stored + localStorage mirror and sets preferredVoice', async () => {
    const { result } = renderHook(() => useLocalTts('pl-PL'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    engine.stored.mockResolvedValue(['pl_PL-gosia-medium']); // now installed
    await act(async () => {
      await result.current.download('pl_PL-gosia-medium');
    });

    expect(engine.download).toHaveBeenCalledWith('pl_PL-gosia-medium', expect.any(Function));
    expect(result.current.hasVoice).toBe(true);
    expect(result.current.preferredVoice).toBe('pl_PL-gosia-medium');
    expect(JSON.parse(localStorage.getItem('osmosmjerkaLocalVoices'))).toContain('pl_PL-gosia-medium');
  });

  test('reports unsupported when the platform lacks storage', async () => {
    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
    const { result } = renderHook(() => useLocalTts('pl-PL'));
    await waitFor(() => expect(result.current.status).toBe('unsupported'));
    expect(engine.voices).not.toHaveBeenCalled();
  });
});
