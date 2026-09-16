// PROBE: след последней заявки в памяти вкладки.
//
// Зачем. На пробе сервера нет, и заявки живут в памяти: скопированная ссылка
// на предложения после перезагрузки открывает пустоту — записи с таким
// токеном больше нет. Пройти круг «оставила заявку → мебельщик ответил →
// увидела ответ» можно только не перезагружая вкладку, а значит нужен
// внутренний переход, а не копирование адреса.
//
// В браузерном хранилище не лежит ничего: только переменная модуля, которая
// умирает вместе со вкладкой — ровно как сам мок (спека §8, контракт §7).
// Телефона и содержания заявки здесь нет, только токен и номер.
let lastToken: string | null = null
let lastNumber: string | null = null

export function rememberRequest(token: string, number: string): void {
  lastToken = token
  lastNumber = number
}

export function lastRequest(): { token: string; number: string } | null {
  return lastToken && lastNumber ? { token: lastToken, number: lastNumber } : null
}
