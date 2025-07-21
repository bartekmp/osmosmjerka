import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

export default defineConfig({
    root: './',
    plugins: [react()],
    build: {
        outDir: './build/',
        emptyOutDir: true
    },
    publicDir: 'public',
    base: '/static/',
});