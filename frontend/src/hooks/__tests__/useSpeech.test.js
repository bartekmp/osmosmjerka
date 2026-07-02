import { renderHook } from '@testing-library/react';
import { useSpeech } from '../useSpeech';

describe('useSpeech', () => {
    let speakMock, cancelMock;

    function installSynth(voices) {
        speakMock = jest.fn();
        cancelMock = jest.fn();
        window.speechSynthesis = {
            getVoices: () => voices,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            speak: speakMock,
            cancel: cancelMock,
        };
        global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
            this.text = text;
            this.lang = undefined;
            this.voice = undefined;
        };
    }

    afterEach(() => {
        delete window.speechSynthesis;
        delete global.SpeechSynthesisUtterance;
    });

    test('reports unsupported when speechSynthesis is missing', () => {
        const { result } = renderHook(() => useSpeech());
        expect(result.current.supported).toBe(false);
        expect(result.current.isLangSupported('pl-PL')).toBe(false);
    });

    test('matches a voice by primary subtag', () => {
        installSynth([{ lang: 'pl-PL', name: 'Polish' }, { lang: 'en-US', name: 'English' }]);
        const { result } = renderHook(() => useSpeech());
        expect(result.current.supported).toBe(true);
        expect(result.current.isLangSupported('pl')).toBe(true); // pl ~ pl-PL
        expect(result.current.isLangSupported('pl-PL')).toBe(true);
        expect(result.current.isLangSupported('hr-HR')).toBe(false); // no Croatian voice
    });

    test('speak cancels then speaks with the requested lang and matched voice', () => {
        const plVoice = { lang: 'pl-PL', name: 'Polish' };
        installSynth([plVoice]);
        const { result } = renderHook(() => useSpeech());
        result.current.speak('kruh', 'pl-PL');
        expect(cancelMock).toHaveBeenCalled();
        expect(speakMock).toHaveBeenCalledTimes(1);
        const utterance = speakMock.mock.calls[0][0];
        expect(utterance.text).toBe('kruh');
        expect(utterance.lang).toBe('pl-PL');
        expect(utterance.voice).toBe(plVoice);
    });

    test('speak is a no-op when unsupported', () => {
        const { result } = renderHook(() => useSpeech());
        expect(() => result.current.speak('x', 'pl-PL')).not.toThrow();
    });
});
