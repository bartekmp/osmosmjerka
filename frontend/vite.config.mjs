import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import path from 'path';

export default defineConfig({
    root: './',
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@features': path.resolve(__dirname, './src/features'),
            '@shared': path.resolve(__dirname, './src/shared'),
            '@contexts': path.resolve(__dirname, './src/contexts'),
            '@helpers': path.resolve(__dirname, './src/helpers'),
            '@hooks': path.resolve(__dirname, './src/hooks'),
            '@locales': path.resolve(__dirname, './src/locales'),
        }
    },
    build: {
        outDir: './build/',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    // Core React dependencies
                    'vendor-react': [
                        'react',
                        'react-dom',
                        'react/jsx-runtime',
                    ],
                    // Material-UI and styling
                    'vendor-mui': [
                        '@mui/material',
                        '@mui/icons-material',
                        '@mui/system',
                        '@emotion/react',
                        '@emotion/styled',
                    ],
                    // Internationalization
                    'vendor-i18n': [
                        'i18next',
                        'react-i18next',
                    ],
                    // Table components
                    'vendor-table': [
                        '@tanstack/react-table',
                    ],
                    // Utilities and external libraries
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