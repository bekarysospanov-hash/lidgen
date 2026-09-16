// US-10 — загрузка снимков в моках (docs/api-contract.md §5, §10).
//
// PROBE: файл никуда не уходит. Мок кладёт его в память вкладки и отдаёт
// blob:-адрес — ровно столько, сколько нужно, чтобы экран показал превью
// и чтобы проверить контракт. Реальный бэкенд примет multipart и вернёт
// адрес хранилища; форма ответа та же, поэтому экран менять не придётся.
import { PHOTO_MAX_BYTES, PHOTO_MIME, Photo } from '../../contract'
import { ApiError } from '../errors'

/** Живёт до перезагрузки вкладки, как и весь мок-стор. */
const uploaded = new Map<string, Photo>()

function newId(): string {
  return crypto.randomUUID()
}

/**
 * Снять снимок. Отзывает blob: — иначе файл держится в памяти вкладки
 * до её перезагрузки, сколько бы снимков человек ни перебрал.
 * Удаление несуществующего — не ошибка: повторное нажатие не должно падать.
 */
export function remove(id: string): void {
  const photo = uploaded.get(id)
  if (!photo) return
  if (photo.url.startsWith('blob:')) URL.revokeObjectURL(photo.url)
  uploaded.delete(id)
}

export function resetPhotos(): void {
  for (const photo of uploaded.values()) {
    // blob:-адреса держат файл в памяти, пока их не отозвать.
    if (photo.url.startsWith('blob:')) URL.revokeObjectURL(photo.url)
  }
  uploaded.clear()
}

/**
 * Приём одного файла. Проверки те же, что обязан делать сервер: тип и размер.
 * Ошибки возвращаются кодами контракта (§6) — мок обязан уметь отказывать,
 * иначе экран никогда не увидит своего состояния ошибки.
 */
export function upload(file: File): Photo {
  const mime = file.type as (typeof PHOTO_MIME)[number]
  if (!PHOTO_MIME.includes(mime)) {
    throw new ApiError('VALIDATION_FAILED', 'Такой файл не подойдёт', {
      path: 'photo.mime',
      got: file.type,
    })
  }
  if (file.size > PHOTO_MAX_BYTES) {
    throw new ApiError('VALIDATION_FAILED', 'Файл слишком большой', {
      path: 'photo.bytes',
      got: file.size,
    })
  }

  const photo = Photo.parse({
    id: newId(),
    url: URL.createObjectURL(file),
    name: file.name,
    bytes: file.size,
    mime,
  })
  uploaded.set(photo.id, photo)
  return photo
}
