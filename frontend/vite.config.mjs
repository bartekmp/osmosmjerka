import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import path from 'path';

// Read version from package.json for fallback when env var is not set
const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

// Self-host the in-browser TTS runtime files so nothing is fetched from a CDN (the Piper
// library otherwise pulls the onnxruntime loader + phonemizer from cdnjs/jsdelivr, which
// fail on CSP/CORS and a stale path). We only need the small onnx JS loader (.mjs) — the
// heavy .wasm is already emitted by Vite from onnxruntime's `new URL(...)` — plus the piper
// phonemizer data/wasm. Served under <base>/wasm/ in both dev and build. See hooks/localTts.js.
function ttsWasmAssets() {
    const files = [
        ['ort-wasm-simd-threaded.jsep.mjs', 'onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs'],
        ['ort-wasm-simd-threaded.jsep.wasm', 'onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm'],
        ['piper_phonemize.data', '@diffusionstudio/piper-wasm/build/piper_phonemize.data'],
        ['piper_phonemize.wasm', '@diffusionstudio/piper-wasm/build/piper_phonemize.wasm'],
    ];
    const abs = (rel) => path.resolve(__dirname, 'node_modules', rel);
    const mime = (n) =>
        n.endsWith('.mjs') ? 'text/javascript' : n.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
    return {
        name: 'tts-wasm-assets',
        generateBundle(_options, bundle) {
            // onnxruntime loads its wasm from our wasmPaths dir, so Vite's auto-emitted
            // hashed copy (from onnxruntime's `new URL(...)`) is dead weight — drop it.
            for (const key of Object.keys(bundle)) {
                if (/ort-wasm-simd-threaded\.jsep.*\.wasm$/.test(key)) delete bundle[key];
            }
            for (const [name, rel] of files) {
                this.emitFile({ type: 'asset', fileName: `wasm/${name}`, source: readFileSync(abs(rel)) });
            }
        },
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const url = (req.url || '').split('?')[0];
                const hit = files.find(([name]) => url.endsWith(`/wasm/${name}`));
                if (!hit) return next();
                res.setHeader('Content-Type', mime(hit[0]));
                res.end(readFileSync(abs(hit[1])));
            });
        },
    };
}

export default defineConfig({
    root: './',
    plugins: [react(), ttsWasmAssets()],
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
                manualChunks(id) {
                    if (!id.includes('node_modules')) return;
                    if (['/react/', '/react-dom/', '/react/jsx-runtime', '/scheduler/'].some(p => id.includes(p))) return 'vendor-react';
                    if (['/@mui/material/', '/@mui/icons-material/', '/@mui/system/', '/@emotion/react/', '/@emotion/styled/'].some(p => id.includes(p))) return 'vendor-mui';
                    if (id.includes('/i18next/') || id.includes('/react-i18next/')) return 'vendor-i18n';
                    if (id.includes('/@tanstack/react-table/')) return 'vendor-table';
                    if (['/axios/', '/react-router-dom/', '/react-canvas-confetti/', '/jwt-decode/'].some(p => id.includes(p))) return 'vendor-utils';
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