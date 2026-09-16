// Сессия кабинета: masterToken и профиль вошедшего (контракт §3, §7).
//
// sessionStorage — именованное исключение из запрета браузерного хранения,
// и только для кабинета: мебельщик ходит между списком и формой ответа
// и обновляет страницу, а вход по коду на каждый F5 означает, что кабинетом
// не пользуются. В хранилище уходит строка сессии и название мастерской —
// ни телефона, ни заявок, ни единого поля заказчицы. Зоны заказчицы это
// исключение не касается: там по-прежнему не хранится ничего.
import { MasterSession } from '../../contract'

const KEY = 'lidgen.master.session'

export function readSession(): MasterSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    // Своё же хранилище разбирается схемой контракта: строка могла остаться
    // от прошлой версии формата, и тихо развалиться на первом обращении
    // к полю — худший из исходов.
    const parsed = MasterSession.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function writeSession(session: MasterSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Приватный режим и запрет хранилища — не повод ронять вход: сессия
    // просто не переживёт перезагрузку.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Нечего чистить — нечего и сообщать.
  }
}
