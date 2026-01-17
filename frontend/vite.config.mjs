import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import path from 'path';

// Read version from package.json for fallback when env var is not set
const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
    root: './',
    plugins: [react()],
    // Development-specific settings
    esbuild: {
        sourcemap: true, // Ensure source maps in dev
    },
    css: {
        devSourcemap: true, // CSS source maps
    },
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
    // Development server configuration
    server: {
        host: '0.0.0.0', // Allow access from any host
        port: 3210,
        strictPort: true,
        allowedHosts: ['localhost', 'workstation.local', 'workstation'], // Allow these hosts
        proxy: {
            '/api': {
                target: 'http://localhost:8085',
                changeOrigin: true,
            },
            // Proxy /admin/ API calls to backend, but not the /admin SPA route
            '/admin': {
                target: 'http://localhost:8085',
                changeOrigin: true,
                // Bypass proxy for SPA routes (HTML requests)
                // Only proxy actual API calls (JSON requests)
                bypass: (req) => {
                    // If Accept header contains text/html, it's a browser navigation - serve SPA
                    if (req.headers.accept && req.headers.accept.includes('text/html')) {
                        return '/index.html';
                    }
                    // Otherwise, proxy to backend (API calls)
                    return null;
                }
            },
        },
        // Ensure all routes fallback to index.html for SPA routing
        historyApiFallback: true,
    },
    // Build configuration (only for production builds)
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
    },
    // Define global constants at build time
    define: {
        __VITE_BASE_PATH__: JSON.stringify(process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/static/' : '/')),
        // Inject version at build time - prefer env var (set by Docker build) over package.json
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.VITE_APP_VERSION || packageJson.version),
    },
    publicDir: 'public',
    // Base path configuration:
    // - Development: '/' (frontend served by Vite dev server on port 3210)
    // - Production: '/static/' (frontend build served by backend from /static/ path)
    // Use explicit command argument or NODE_ENV check
    base: process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/static/' : '/'),
});