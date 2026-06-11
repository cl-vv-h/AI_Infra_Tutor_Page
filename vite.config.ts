import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig({
  base: '/AI_Infra_Tutor_Page/',
  build: {
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/mermaid/')) return 'mermaid'
          if (id.includes('node_modules/katex/')) return 'mermaid'
          if (id.includes('node_modules/cytoscape/')) return 'mermaid'
          if (id.includes('node_modules/dagre/')) return 'mermaid'
          if (id.includes('node_modules/d3-')) return 'mermaid'
          if (id.includes('node_modules/highlight.js/')) return 'highlight'
          if (id.includes('src/data/sglang-content/')) return 'sglang-content'
        },
      },
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }), 
    tsconfigPaths()
  ],
})
