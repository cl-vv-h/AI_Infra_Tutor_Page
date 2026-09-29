import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { releaseMetadata } from './scripts/release-metadata.mjs'

const release = releaseMetadata(fileURLToPath(new URL('.', import.meta.url)))

// https://vite.dev/config/
export default defineConfig({
  base: '/AI_Infra_Tutor_Page/',
  define: {
    __SITE_FEATURES__: JSON.stringify(release.features),
    __CALCULATOR_FINGERPRINT__: JSON.stringify(release.calculatorFingerprint),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    manifest: true,
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/highlight.js/')) return 'highlight'
        },
      },
    },
  },
  plugins: [
    react(),
    { name: 'public-release-metadata', generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'release.json', source: JSON.stringify(release) })
    } },
  ],
})
