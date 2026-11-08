import apiClient from '@shared/utils/apiClient';

// How many phrase lines go into a single request. Small enough that the progress bar
// moves several times on a typical file, large enough that we are not paying request
// overhead per row.
export const DEFAULT_CHUNK_SIZE = 500;

const SEPARATOR_CANDIDATES = [';', ',', '|', '\t'];

// Mirrors the backend's detection in _parse_phrases_csv: pick the candidate that
// appears most often in the first non-empty line.
function detectSeparator(firstLine) {
    const header = firstLine.toLowerCase();
    for (const candidate of SEPARATOR_CANDIDATES) {
        if (header.includes(`categories${candidate}phrase${candidate}translation`)) return candidate;
        if (header.includes(`category${candidate}phrase${candidate}translation`)) return candidate;
    }

    let best = null;
    let bestCount = 0;
    for (const candidate of SEPARATOR_CANDIDATES) {
        const count = firstLine.split(candidate).length - 1;
        if (count > bestCount) {
            bestCount = count;
            best = candidate;
        }
    }
    // Three columns need at least two separators.
    return bestCount >= 2 ? best : null;
}

function isHeaderLine(line, separator) {
    const normalized = line.toLowerCase().trim();
    return [
        `categories${separator}phrase${separator}translation`,
        `category${separator}phrase${separator}translation`,
        `categories${separator}phrases${separator}translations`,
    ].includes(normalized);
}

/**
 * Split raw file text into chunks of phrase lines.
 *
 * The header is dropped here rather than sent with every chunk, and the separator is
 * detected once, so each chunk can be posted on its own with an explicit separator.
 *
 * @returns {{separator: string|null, headerLines: number, total: number, chunks: string[][]}}
 */
export function splitPhraseLines(text, chunkSize = DEFAULT_CHUNK_SIZE) {
    const lines = text
        .replace(/^\uFEFF/, '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .filter((line) => line.trim());

    if (!lines.length) {
        return { separator: null, headerLines: 0, total: 0, chunks: [] };
    }

    const separator = detectSeparator(lines[0]);
    if (!separator) {
        return { separator: null, headerLines: 0, total: 0, chunks: [] };
    }

    const headerLines = isHeaderLine(lines[0], separator) ? 1 : 0;
    const dataLines = lines.slice(headerLines);

    const chunks = [];
    for (let i = 0; i < dataLines.length; i += chunkSize) {
        chunks.push(dataLines.slice(i, i + chunkSize));
    }

    return { separator, headerLines, total: dataLines.length, chunks };
}

// The backend takes a literal character for ; , | but the word "tab" for a tab.
function separatorLabel(separator) {
    return separator === '\t' ? 'tab' : separator;
}

function messageFromError(err) {
    const data = err?.response?.data;
    return data?.error || data?.message || data?.detail || err?.message || 'Upload failed';
}

/**
 * Upload phrase lines in sequential chunks, reporting progress after each one.
 *
 * Sequential on purpose: every chunk writes to the same language set, and a single
 * failing chunk should stop the import rather than race the rest in behind it.
 *
 * @param {object} args
 * @param {string} args.text Raw file contents.
 * @param {number} args.languageSetId Target language set.
 * @param {number} [args.chunkSize] Lines per request.
 * @param {(progress: {processed: number, total: number}) => void} [args.onProgress]
 * @returns {Promise<{imported: number, total: number}>}
 * @throws {Error} With `imported`, `total` and `failedAtLine` attached on a partial import.
 */
export async function uploadPhrasesInChunks({ text, languageSetId, chunkSize = DEFAULT_CHUNK_SIZE, onProgress }) {
    const { separator, headerLines, total, chunks } = splitPhraseLines(text, chunkSize);

    if (!separator || !total) {
        throw new Error('Could not detect a separator. Expected lines like: categories;phrase;translation');
    }

    const url = `/admin/upload-text?language_set_id=${encodeURIComponent(languageSetId)}`;
    let imported = 0;

    // Report the total before the first request so the progress bar starts out
    // determinate and the admin can see how big the job is.
    if (onProgress) onProgress({ processed: 0, total });

    for (const chunk of chunks) {
        try {
            await apiClient.post(url, { content: chunk.join('\n'), separator: separatorLabel(separator) });
        } catch (err) {
            const error = new Error(messageFromError(err));
            error.imported = imported;
            error.total = total;
            // Line numbers in the backend's message are relative to the chunk, so hand
            // the caller the file line this chunk started at.
            error.failedAtLine = headerLines + imported + 1;
            error.cause = err;
            throw error;
        }

        imported += chunk.length;
        if (onProgress) onProgress({ processed: imported, total });
    }

    return { imported, total };
}
