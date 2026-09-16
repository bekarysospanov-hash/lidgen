// mockApi реализует тот же интерфейс Api, что и httpApi. Подмена — в client.ts.
import type { Api } from '../types'
import { confirm, create, getByToken, resend } from './requests'

// PROBE: искусственная задержка ответа — имитирует сетевой RTT реального
// бэка, чтобы состояния загрузки на экранах проверялись по-настоящему (§10).
// В тестах 0: набор тестов не должен ползти из-за декораций, а ждать
// выдуманный RTT в проверке контракта нечего.
const DEFAULT_DELAY_MS = import.meta.env?.MODE === 'test' ? 0 : 400

const delayMs = Number(import.meta.env?.VITE_MOCK_DELAY_MS ?? DEFAULT_DELAY_MS)

function delay(): Promise<void> {
  if (!delayMs || delayMs <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

export const mockApi: Api = {
  async createRequest(input) {
    await delay()
    return create(input)
  },
  async resendOtp(input) {
    await delay()
    return resend(input)
  },
  async confirmOtp(input) {
    await delay()
    return confirm(input)
  },
  async getRequestByToken(token) {
    await delay()
    return getByToken(token)
  },
}

export { reset, listEvents, getRequestRecord } from './store'
