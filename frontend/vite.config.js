import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // В CORS backend разрешён именно http://localhost:5173 — не 127.0.0.1.
    host: 'localhost',
    port: 5173,
    strictPort: true, // если порт занят — ошибка, а не тихий переезд на 5174
    open: true,
  },
  test: {
    environment: 'jsdom',
    // Автотесты не зависят от личного frontend/.env.local (Vite в режиме test тоже его читает):
    // авторизация и афиша — на мок-серверах, схема зала и брони — через подменённый fetch.
    env: {
      VITE_USE_MOCKS: 'true',
      VITE_MOCK_CINEMA: 'true',
    },
    setupFiles: './tests/setup.js',
    include: ['tests/**/*.test.{js,jsx}'],
    css: false,
  },
})
