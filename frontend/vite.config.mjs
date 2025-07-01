import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const version = readFileSync('../VERSION', 'utf-8').trim();

export default defineConfig({
    root: './',
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(version),
    },
    build: {
        outDir: './build/',
        emptyOutDir: true
    },
    publicDir: 'public',
    base: '/static/',
});