import apiClient from '@shared/utils/apiClient';
import { splitPhraseLines, uploadPhrasesInChunks } from '../uploadPhrasesInChunks';

jest.mock('@shared/utils/apiClient');

describe('splitPhraseLines', () => {
    test('detects the semicolon separator, drops the header and chunks the data lines', () => {
        const text = [
            'categories;phrase;translation',
            'Hrana;voda;woda',
            'Hrana;kruh;chleb',
            'Priroda;more;morze',
            'Priroda;gora;gora',
            'Priroda;rijeka;rzeka',
        ].join('\n');

        const result = splitPhraseLines(text, 2);

        expect(result.separator).toBe(';');
        expect(result.total).toBe(5);
        expect(result.chunks).toEqual([
            ['Hrana;voda;woda', 'Hrana;kruh;chleb'],
            ['Priroda;more;morze', 'Priroda;gora;gora'],
            ['Priroda;rijeka;rzeka'],
        ]);
    });

    test('works without a header line', () => {
        const result = splitPhraseLines('Hrana;voda;woda\nHrana;kruh;chleb', 10);

        expect(result.total).toBe(2);
        expect(result.chunks).toEqual([['Hrana;voda;woda', 'Hrana;kruh;chleb']]);
    });

    test('ignores blank lines and a UTF-8 BOM', () => {
        const result = splitPhraseLines('﻿categories;phrase;translation\n\nHrana;voda;woda\n\n', 10);

        expect(result.total).toBe(1);
        expect(result.chunks).toEqual([['Hrana;voda;woda']]);
    });

    test('detects tab-separated input', () => {
        const result = splitPhraseLines('Hrana\tvoda\twoda', 10);

        expect(result.separator).toBe('\t');
    });

    test('reports no separator for content that is not delimited', () => {
        const result = splitPhraseLines('this is not a csv file', 10);

        expect(result.separator).toBeNull();
        expect(result.total).toBe(0);
    });
});

describe('uploadPhrasesInChunks', () => {
    beforeEach(() => jest.clearAllMocks());

    const text = 'categories;phrase;translation\n' +
        Array.from({ length: 5 }, (_, i) => `cat;phrase${i};translation${i}`).join('\n');

    test('posts one request per chunk with an explicit separator and reports cumulative progress', async () => {
        apiClient.post.mockResolvedValue({ data: { message: 'ok' } });
        const onProgress = jest.fn();

        const result = await uploadPhrasesInChunks({ text, languageSetId: 7, chunkSize: 2, onProgress });

        expect(result).toEqual({ imported: 5, total: 5 });
        expect(apiClient.post).toHaveBeenCalledTimes(3);
        expect(apiClient.post).toHaveBeenNthCalledWith(
            1,
            '/admin/upload-text?language_set_id=7',
            { content: 'cat;phrase0;translation0\ncat;phrase1;translation1', separator: ';' }
        );
        expect(onProgress.mock.calls.map(([p]) => p.processed)).toEqual([0, 2, 4, 5]);
        expect(onProgress).toHaveBeenLastCalledWith({ processed: 5, total: 5 });
    });

    test('sends the tab separator under the label the backend expects', async () => {
        apiClient.post.mockResolvedValue({ data: {} });

        await uploadPhrasesInChunks({ text: 'cat\tphrase\ttranslation', languageSetId: 1, chunkSize: 10 });

        expect(apiClient.post).toHaveBeenCalledWith(
            '/admin/upload-text?language_set_id=1',
            { content: 'cat\tphrase\ttranslation', separator: 'tab' }
        );
    });

    test('stops at the first failing chunk and reports how much landed', async () => {
        apiClient.post
            .mockResolvedValueOnce({ data: {} })
            .mockRejectedValueOnce({ response: { data: { error: 'Line 2: Expected 3 columns' } } });

        await expect(
            uploadPhrasesInChunks({ text, languageSetId: 7, chunkSize: 2 })
        ).rejects.toMatchObject({
            message: 'Line 2: Expected 3 columns',
            imported: 2,
            total: 5,
            failedAtLine: 4,
        });

        // Third chunk must not be sent after a failure.
        expect(apiClient.post).toHaveBeenCalledTimes(2);
    });

    test('rejects content with no usable separator before sending anything', async () => {
        await expect(
            uploadPhrasesInChunks({ text: 'nonsense', languageSetId: 1, chunkSize: 10 })
        ).rejects.toThrow(/separator/i);

        expect(apiClient.post).not.toHaveBeenCalled();
    });
});
