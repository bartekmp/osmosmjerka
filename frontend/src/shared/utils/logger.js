/**
 * Lightweight app logger.
 *
 * Debug-level output (log/info/debug/warn) is silenced in production builds so
 * the browser console stays clean for end users; errors are always logged.
 * Uses process.env.NODE_ENV, which Vite statically replaces at build time and
 * Jest provides, so it works in both environments.
 */
const isProduction =
    typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';

const noop = () => {};

const logger = {
    log: isProduction ? noop : (...args) => console.log(...args),
    info: isProduction ? noop : (...args) => console.info(...args),
    debug: isProduction ? noop : (...args) => console.debug(...args),
    warn: isProduction ? noop : (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
};

export default logger;
