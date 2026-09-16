// Единая точка вызова API. Ни один компонент не ходит в моки напрямую —
// подмена на реальный бэкенд должна быть переключателем, а не переписыванием
// экранов (конвенция проекта, CLAUDE.md).
//
// Моки реализуют тот же контракт (src/contract), что потом реализует сервер,
// поэтому переключение не меняет ни одного экрана: VITE_USE_MOCKS=false —
// и те же вызовы уходят в httpApi по путям docs/api-contract.md §5.
import { httpApi } from './http'
import { mockApi } from './mocks'
import type { Api } from './types'

const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false'

export const api: Api = useMocks ? mockApi : httpApi
