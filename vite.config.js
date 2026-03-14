import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    strictPort: true,
  },
  plugins: [
    {
      name: 'html-include',
      enforce: 'pre',                    // ✅ No 'as const' needed in .js
      transformIndexHtml(html) {
        function processIncludes(content, currentFile, visited) {
          return content.replace(
            /<!--@include\s+(.+?)-->/g,
            (match, filePath) => {
              const fullPath = path.resolve(path.dirname(currentFile), filePath.trim());

              if (visited.has(fullPath)) {
                console.warn(`⚠️ Circular include detected: ${fullPath}`);
                return `<!--@include ${filePath} (CIRCULAR)-->`;
              }

              if (!fs.existsSync(fullPath)) {
                console.warn(`⚠️ HTML include not found: ${filePath}`);
                return `<!--@include ${filePath} (NOT FOUND)-->`;
              }

              const included = fs.readFileSync(fullPath, 'utf-8');
              visited.add(fullPath);
              return processIncludes(included, fullPath, visited);
            }
          );
        }

        const indexPath = path.resolve(__dirname, 'index.html');
        return processIncludes(html, indexPath, new Set([indexPath]));
      }
    },

    visualizer({
      filename: 'stats.html',
      template: 'network',
      open: true,
      gzipSize: true,
      brotliSize: true,
      json: true
    })
  ]
});