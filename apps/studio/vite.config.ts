import { findProjectRoot } from '@linkzag/scene-loader'
import { linkzagContentPlugin } from '@linkzag/scene-loader'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const projectRoot = findProjectRoot(fileURLToPath(new URL('.', import.meta.url)))

export default defineConfig({
  plugins: [react(), linkzagContentPlugin({ projectRoot })],
  server: {
    host: '127.0.0.1',
    port: 5174,
  },
  preview: {
    host: '127.0.0.1',
    port: 4174,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'echarts', 'mermaid', '@xyflow/react'],
  },
  build: {
    target: 'chrome120',
    sourcemap: false,
  },
})
