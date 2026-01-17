/**
 * App version module
 * 
 * This module exports the app version, injected at build time via Vite.
 * Uses environment variable with fallback to a default version.
 * 
 * The separate module allows for easier mocking in Jest tests.
 */

// Vite injects this at build time via vite.config.mjs define block
const appVersion = import.meta.env.VITE_APP_VERSION || '0.0.0';

export default appVersion;
