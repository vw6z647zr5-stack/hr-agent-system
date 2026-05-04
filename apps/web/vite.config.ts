import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (/[\\/]node_modules[\\/](react|react-dom|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react';
          }

          if (/[\\/]node_modules[\\/](@ant-design|antd|@rc-component|rc-[^\\/]+)[\\/]/.test(id)) {
            return 'ui';
          }

          if (/[\\/]node_modules[\\/](dayjs|zustand)[\\/]/.test(id)) {
            return 'runtime';
          }

          if (/[\\/]node_modules[\\/](socket\.io-client|@socket\.io|engine\.io-client)[\\/]/.test(id)) {
            return 'realtime';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    host: process.env.VITE_DEV_HOST || '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
