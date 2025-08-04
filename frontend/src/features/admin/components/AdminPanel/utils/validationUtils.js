/**
 * Checks if a string contains HTML tags
 * @param {string} text - The text to check
 * @returns {boolean}
 */
export const containsHTML = (text) => {
    if (!text) return false;
    // More specific regex to match HTML tags (requires a tag name)
    const htmlRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    return htmlRegex.test(text);
};

/**
 * Strips HTML tags from a string
 * @param {string} text - The text to strip
 * @returns {string}
 */
export const stripHTML = (text) => {
    if (!text) return '';
    return text.replace(/<[^>]*>/g, '');
};
