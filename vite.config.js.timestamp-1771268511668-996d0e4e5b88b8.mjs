// vite.config.js
import { defineConfig } from "file:///C:/Users/mega/mega_env/MEGA5/dashboard/node_modules/vite/dist/node/index.js";
import fs from "fs";
import path from "path";
import { visualizer } from "file:///C:/Users/mega/mega_env/MEGA5/dashboard/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
var __vite_injected_original_dirname = "C:\\Users\\mega\\mega_env\\MEGA5\\dashboard";
var vite_config_default = defineConfig({
  root: ".",
  server: {
    port: 3e3,
    strictPort: true
  },
  plugins: [
    {
      name: "html-include",
      transformIndexHtml(html) {
        return html.replace(
          /<!--@include\s+(.+?)-->/g,
          (match, filePath) => {
            const fullPath = path.resolve(__vite_injected_original_dirname, filePath.trim());
            if (fs.existsSync(fullPath)) {
              return fs.readFileSync(fullPath, "utf-8");
            }
            console.warn(`File not found: ${filePath}`);
            return match;
          }
        );
      }
    },
    // 🔎 Module hierarchy visualizer
    visualizer({
      filename: "stats.html",
      template: "network",
      // network | treemap | sunburst
      open: true,
      gzipSize: true,
      brotliSize: true,
      json: true
    })
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxtZWdhXFxcXG1lZ2FfZW52XFxcXE1FR0E1XFxcXGRhc2hib2FyZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcbWVnYVxcXFxtZWdhX2VudlxcXFxNRUdBNVxcXFxkYXNoYm9hcmRcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL21lZ2EvbWVnYV9lbnYvTUVHQTUvZGFzaGJvYXJkL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCBmcyBmcm9tICdmcyc7XHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyB2aXN1YWxpemVyIH0gZnJvbSAncm9sbHVwLXBsdWdpbi12aXN1YWxpemVyJztcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcm9vdDogJy4nLFxyXG4gIHNlcnZlcjoge1xyXG4gICAgcG9ydDogMzAwMCxcclxuICAgIHN0cmljdFBvcnQ6IHRydWUsXHJcbiAgfSxcclxuICBwbHVnaW5zOiBbXHJcbiAgICB7XHJcbiAgICAgIG5hbWU6ICdodG1sLWluY2x1ZGUnLFxyXG4gICAgICB0cmFuc2Zvcm1JbmRleEh0bWwoaHRtbCkge1xyXG4gICAgICAgIHJldHVybiBodG1sLnJlcGxhY2UoXHJcbiAgICAgICAgICAvPCEtLUBpbmNsdWRlXFxzKyguKz8pLS0+L2csXHJcbiAgICAgICAgICAobWF0Y2gsIGZpbGVQYXRoKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgZmlsZVBhdGgudHJpbSgpKTtcclxuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZnVsbFBhdGgpKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIGZzLnJlYWRGaWxlU3luYyhmdWxsUGF0aCwgJ3V0Zi04Jyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGBGaWxlIG5vdCBmb3VuZDogJHtmaWxlUGF0aH1gKTtcclxuICAgICAgICAgICAgcmV0dXJuIG1hdGNoO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICk7XHJcbiAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgLy8gXHVEODNEXHVERDBFIE1vZHVsZSBoaWVyYXJjaHkgdmlzdWFsaXplclxyXG4gICAgdmlzdWFsaXplcih7XHJcbiAgICAgIGZpbGVuYW1lOiAnc3RhdHMuaHRtbCcsXHJcbiAgICAgIHRlbXBsYXRlOiAnbmV0d29yaycsICAgLy8gbmV0d29yayB8IHRyZWVtYXAgfCBzdW5idXJzdFxyXG4gICAgICBvcGVuOiB0cnVlLFxyXG4gICAgICBnemlwU2l6ZTogdHJ1ZSxcclxuICAgICAgYnJvdGxpU2l6ZTogdHJ1ZSxcclxuICAgICAganNvbjogdHJ1ZVxyXG4gICAgfSlcclxuICBdXHJcbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBZ1QsU0FBUyxvQkFBb0I7QUFDN1UsT0FBTyxRQUFRO0FBQ2YsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsa0JBQWtCO0FBSDNCLElBQU0sbUNBQW1DO0FBS3pDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLE1BQU07QUFBQSxFQUNOLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQSxFQUNkO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUDtBQUFBLE1BQ0UsTUFBTTtBQUFBLE1BQ04sbUJBQW1CLE1BQU07QUFDdkIsZUFBTyxLQUFLO0FBQUEsVUFDVjtBQUFBLFVBQ0EsQ0FBQyxPQUFPLGFBQWE7QUFDbkIsa0JBQU0sV0FBVyxLQUFLLFFBQVEsa0NBQVcsU0FBUyxLQUFLLENBQUM7QUFDeEQsZ0JBQUksR0FBRyxXQUFXLFFBQVEsR0FBRztBQUMzQixxQkFBTyxHQUFHLGFBQWEsVUFBVSxPQUFPO0FBQUEsWUFDMUM7QUFDQSxvQkFBUSxLQUFLLG1CQUFtQixRQUFRLEVBQUU7QUFDMUMsbUJBQU87QUFBQSxVQUNUO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUE7QUFBQSxJQUdBLFdBQVc7QUFBQSxNQUNULFVBQVU7QUFBQSxNQUNWLFVBQVU7QUFBQTtBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sVUFBVTtBQUFBLE1BQ1YsWUFBWTtBQUFBLE1BQ1osTUFBTTtBQUFBLElBQ1IsQ0FBQztBQUFBLEVBQ0g7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
