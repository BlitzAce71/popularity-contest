import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Target modern browsers for better optimization
    target: 'es2020',
    
    // Optimize bundle size
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunk for React and related libraries
          react: ['react', 'react-dom', 'react-router-dom'],
          
          // UI libraries chunk
          ui: ['lucide-react', '@hookform/resolvers', 'react-hook-form'],
          
          // Supabase chunk
          supabase: ['@supabase/supabase-js'],
          
          // Form validation chunk
          validation: ['zod'],
        },
        
        // Better asset naming for caching
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name!.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext)) {
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    
    // Minification settings
    minify: 'terser',
    
    // Source maps for production debugging
    sourcemap: false,
    
    // Optimize CSS
    cssCodeSplit: true,
    
    // Report bundle size
    reportCompressedSize: true,
    
    // Chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  
  // Development server configuration
  server: {
    port: 3000,
    open: true,
    host: true,
  },
  
  // Preview server configuration
  preview: {
    port: 4173,
    host: true,
  },
  
  // Environment variable handling
  envPrefix: 'VITE_',
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'zod',
      'react-hook-form',
      '@hookform/resolvers/zod',
      'lucide-react'
    ],
  },
})
