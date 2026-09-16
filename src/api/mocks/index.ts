// mockApi реализует тот же интерфейс Api, что и httpApi. Подмена — в client.ts.
import type { Api } from '../types'
import { remove, upload } from './photos'
import { confirm, create, getByToken, resend } from './requests'
import { confirmCode, getRequest, listRequests, requestCode, sendQuote } from './master'

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
  async uploadPhoto(file) {
    await delay()
    return upload(file)
  },
  async deletePhoto(id) {
    await delay()
    remove(id)
  },
  async masterRequestCode(input) {
    await delay()
    return requestCode(input)
  },
  async masterConfirmCode(input) {
    await delay()
    return confirmCode(input)
  },
  async listRequestsForMaster(token) {
    await delay()
    return listRequests(token)
  },
  async getRequestForMaster(token, id) {
    await delay()
    return getRequest(token, id)
  },
  async createQuote(token, id, input) {
    await delay()
    return sendQuote(token, id, input)
  },
}

export { reset, listEvents, getRequestRecord } from './store'
export { resetPhotos } from './photos'
export { listMasters, findMasterByPhone } from './masters'
export { routingFor } from './routing'
