// mockApi реализует тот же интерфейс Api, что и httpApi. Подмена — в client.ts.
import type { Api } from '../types'
import { remove, upload } from './photos'
import { acceptEvents, confirm, create, getByToken, listMine, resend, resendLink } from './requests'
import {
  authConfirmCode as authConfirmCodeMock,
  getRequest,
  listRequests,
  myCard,
  authRequestCode as authRequestCodeMock,
  signOut as signOutMock,
  reviseQuote,
  saveMyCard,
  sendQuote,
} from './master'
import { getCatalogueCard, listCatalogue } from './masters'

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
  async sendEvents(input) {
    await delay()
    acceptEvents(input)
  },
  async resendLink(input) {
    await delay()
    return resendLink(input)
  },
  async listMasters() {
    await delay()
    return listCatalogue()
  },
  async getMasterCard(id) {
    await delay()
    return getCatalogueCard(id)
  },
  async authRequestCode(input) {
    await delay()
    return authRequestCodeMock(input)
  },
  async authConfirmCode(input) {
    await delay()
    return authConfirmCodeMock(input)
  },
  async signOut(token) {
    await delay()
    signOutMock(token)
  },
  async listMyRequests(token) {
    await delay()
    return listMine(token)
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
  async updateQuote(token, id, input) {
    await delay()
    return reviseQuote(token, id, input)
  },
  async getMyCard(token) {
    await delay()
    return myCard(token)
  },
  async updateMyCard(token, input) {
    await delay()
    return saveMyCard(token, input)
  },
}

export { reset, listEvents, getRequestRecord } from './store'
export { resetPhotos } from './photos'
// PROBE: мессенджера в пробе нет — ссылку показывает экран (US-21).
export { probeLinkFor } from './requests'
export { listMasters, findMasterByPhone } from './masters'
export { routingFor } from './routing'
