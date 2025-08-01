/**
 * Game configuration constants
 */

// Game difficulty settings
export const GAME_DIFFICULTIES = {
  EASY: 'easy',
  MEDIUM: 'medium', 
  HARD: 'hard',
  DYNAMIC: 'dynamic'
};

// Grid configuration
export const GRID_CONFIG = {
  MIN_CELL_SIZE: 15,
  MAX_CELL_SIZE: 70,
  CELL_GAP: 4,
  MIN_TOUCH_TARGET: 44
};

// UI Layout constants
export const UI_LAYOUT = {
  HEADER_HEIGHT: { xs: 48, sm: 56, md: 64, lg: 72 },
  CONTROL_BUTTON_SIZE: { xs: 36, sm: 44, md: 48 },
  MOBILE_MENU_BUTTON_HEIGHT: 40,
  ADMIN_BUTTON_HEIGHT: 48,
  ADMIN_BUTTON_MIN_WIDTH: 72
};

// Animation timings
export const ANIMATIONS = {
  BLINK_DURATION: 1000,
  CELEBRATION_DURATION: 3000,
  THEME_TRANSITION: '0.3s ease'
};

// Local storage keys
export const STORAGE_KEYS = {
  GAME_STATE: 'osmosmjerkaGameState',
  THEME: 'osmosmjerka-dark-mode',
  LANGUAGE: 'lng',
  ADMIN_TOKEN: 'adminToken'
};

// API endpoints
export const API_ENDPOINTS = {
  CATEGORIES: '/api/categories',
  IGNORED_CATEGORIES: '/api/ignored-categories',
  WORDS: '/api/words',
  EXPORT: '/api/export',
  ADMIN_STATUS: '/admin/status',
  ADMIN_CLEAR: '/admin/clear'
};
