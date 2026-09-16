// US-10 — фотографии помещения (docs/api-contract.md §2, §5).
//
// Зачем в срезе 1, хотя карта историй ставит US-10 в срез 3: без снимка
// мебельщик считает цену вслепую, а цена — то единственное, ради чего
// заказчица оставляет заявку. Решение PM от 16.09.
import { z } from 'zod'

/** Не больше пяти: шестой снимок не добавляет мебельщику знания (§5). */
export const PHOTO_MAX_COUNT = 5
/** 10 МБ на файл — снимок с телефона помещается, видео и сканы отсекаются. */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024
/** Что принимаем. Heic отдаёт iPhone по умолчанию, и его нельзя не брать. */
export const PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const

/**
 * Загруженный снимок. `url` не типизирован как URL намеренно: реальный бэкенд
 * отдаёт абсолютный адрес хранилища, мок — `blob:` вкладки, и оба обязаны
 * пройти одну схему. Формат адреса выбирает сервер, фронт его не разбирает
 * (тот же принцип, что с номером заявки, §1).
 */
export const Photo = z.object({
  id: z.uuid(),
  url: z.string().min(1),
  name: z.string().min(1),
  bytes: z.number().int().positive().max(PHOTO_MAX_BYTES),
  mime: z.enum(PHOTO_MIME),
})
export type Photo = z.infer<typeof Photo>

/** Тело загрузки. Multipart на бэкенде, здесь — описание того, что уходит. */
export const UploadPhotoInput = z.object({
  name: z.string().min(1),
  bytes: z.number().int().positive(),
  mime: z.string().min(1),
})
export type UploadPhotoInput = z.infer<typeof UploadPhotoInput>

/**
 * Список снимков заявки. Пустой список законен и это главное правило US-10:
 * фото просим настойчиво, но отправку оно не блокирует — человек с телефона
 * в магазине не всегда может сфотографировать комнату прямо сейчас.
 */
export const Photos = z.array(Photo).max(PHOTO_MAX_COUNT).default([])
export type Photos = z.infer<typeof Photos>
