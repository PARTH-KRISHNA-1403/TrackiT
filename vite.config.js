import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const dbUrl = env.VITE_NEON_DATABASE_URL || env.DATABASE_URL || env.DATABASE_URL_UNPOOLED || ''

  return {
    define: {
      'import.meta.env.VITE_NEON_DATABASE_URL': JSON.stringify(dbUrl)
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Grocery Tracker',
          short_name: 'Groceries',
          description: 'Track your personal grocery purchases and analyze prices',
          theme_color: '#4f46e5',
          icons: [
            {
              src: '/vite.svg',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: '/vite.svg',
              sizes: '512x512',
              type: 'image/svg+xml'
            }
          ]
        }
      })
    ],
    base: process.env.VITE_BASE_PATH || "/"
  }
})

