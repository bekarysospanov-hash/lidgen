// Сессия: токен, роли и срок (контракт §3, §5в, §7).
//
// Одна на обе роли с 20.09. До этого сессия жила в `pages/master` и знала
// только мебельщика — потому что дверей было две. Стала одна: человек
// входит по номеру, сервер сам решает, что ему доступно, и мебельщик,
// заказавший себе шкаф, больше не выбирает между двумя своими ролями.
//
// sessionStorage — именованное исключение из запрета браузерного хранения.
// Человек ходит между списком и карточкой и обновляет страницу; вход
// по коду на каждый F5 означает, что кабинетом не пользуются. В хранилище
// уходит строка сессии, роли, срок и название мастерской — **телефона нет
// ни в каком виде**, заявок нет, полей заказчицы нет.
import { Session, type SessionRole } from './contract'

const KEY = 'lidgen.session'

export function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    // Своё же хранилище разбирается схемой контракта: строка могла остаться
    // от прошлой версии формата, и тихо развалиться на первом обращении
    // к полю — худший из исходов.
    const parsed = Session.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    // Протухшую сессию отдавать нельзя: экран покажет кабинет, первый же
    // запрос ответит UNAUTHORIZED, и человек решит, что продукт сломался.
    if (Date.parse(parsed.data.expiresAt) <= Date.now()) return null
    return parsed.data
  } catch {
    return null
  }
}

export function writeSession(session: Session): void {
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

/**
 * Есть ли роль. Гейт кабинета мастерской стоит на ней, а не на самом факте
 * входа: вошедший заказчик не должен снова видеть форму входа.
 *
 * Предикат, а не boolean: после проверки экран работает с сессией как
 * с непустой, и городить рядом второй `session !== null` незачем.
 */
export function hasRole(session: Session | null, role: SessionRole): session is Session {
  return session !== null && session.roles.includes(role)
}
