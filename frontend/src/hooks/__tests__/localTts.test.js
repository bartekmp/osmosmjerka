import {
  cachedInstalledVoices,
  installedVoiceForLang,
  primarySubtag,
  setCachedInstalledVoices,
  voiceMatchesLang,
} from '../localTts';

describe('localTts helpers', () => {
  beforeEach(() => localStorage.clear());

  test('primarySubtag normalizes BCP-47 and Piper tags', () => {
    expect(primarySubtag('pl-PL')).toBe('pl');
    expect(primarySubtag('pl_PL')).toBe('pl');
    expect(primarySubtag('PL')).toBe('pl');
    expect(primarySubtag('')).toBe('');
  });

  test('voiceMatchesLang matches a Piper voiceId to a target lang by primary subtag', () => {
    expect(voiceMatchesLang('pl_PL-gosia-medium', 'pl-PL')).toBe(true);
    expect(voiceMatchesLang('pl_PL-gosia-medium', 'pl')).toBe(true);
    expect(voiceMatchesLang('hr_HR-x-medium', 'pl-PL')).toBe(false);
    expect(voiceMatchesLang('', 'pl')).toBe(false);
    expect(voiceMatchesLang('pl_PL-x', '')).toBe(false);
  });

  test('localStorage mirror round-trips and finds a voice for a language', () => {
    expect(cachedInstalledVoices()).toEqual([]);
    setCachedInstalledVoices(['pl_PL-gosia-medium', 'hr_HR-x-medium']);
    expect(cachedInstalledVoices()).toEqual(['pl_PL-gosia-medium', 'hr_HR-x-medium']);
    expect(installedVoiceForLang('pl-PL')).toBe('pl_PL-gosia-medium');
    expect(installedVoiceForLang('hr-HR')).toBe('hr_HR-x-medium');
    expect(installedVoiceForLang('de-DE')).toBeNull();
  });

  test('cachedInstalledVoices tolerates corrupt storage', () => {
    localStorage.setItem('osmosmjerkaLocalVoices', 'not json');
    expect(cachedInstalledVoices()).toEqual([]);
  });
});
