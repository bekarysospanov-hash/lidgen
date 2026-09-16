// Отдельный конфиг вместо правки vite.config.ts (там уже стоит react() +
// tailwindcss() под dev-сервер и порт из PORT — тестам это не нужно).
// Vitest с собственным vitest.config.ts игнорирует vite.config.ts целиком,
// так что конфликта с server.port нет.
//
// Границы среза (решение PM): тестируем только контракт/моки/http-клиент —
// zod-схемы и логика без DOM. environment: 'node', никакого jsdom.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
