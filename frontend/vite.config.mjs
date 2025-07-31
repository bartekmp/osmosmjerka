import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

export default defineConfig({
    root: './',
    plugins: [react()],
    build: {
        outDir: './build/',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': [
                        'react',
                        'react-dom',
                        'react/jsx-runtime',
                    ],
                    'vendor-mui': [
                        '@mui/material',
                        '@mui/icons-material',
                        '@mui/system',
                        '@emotion/react',
                        '@emotion/styled',
                    ],
                    'vendor-i18n': [
                        'i18next',
                        'react-i18next',
                    ],
                    'vendor-table': [
                        '@tanstack/react-table',
                    ],
                    'vendor-utils': [
                        'axios',
                        'react-router-dom',
                        'react-canvas-confetti',
                        'jwt-decode',
                    ],
                }
            }
        },
        chunkSizeWarningLimit: 600
    },
    publicDir: 'public',
    base: '/static/',
});