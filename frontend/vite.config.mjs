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
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
                    'vendor-i18n': ['i18next', 'react-i18next'],
                    'vendor-utils': ['axios', 'jwt-decode', 'react-router-dom', 'react-canvas-confetti']
                }
            }
        },
        chunkSizeWarningLimit: 600
    },
    publicDir: 'public',
    base: '/static/',
});