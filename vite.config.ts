import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // порт назначает харнесс превью через PORT; без него — дефолт Vite
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
