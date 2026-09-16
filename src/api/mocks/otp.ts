// PROBE: код 1234 проходит всегда — замена реальной отправке и проверке OTP.
// На проде код не константа, а лимит попыток включается без правки контракта
// (§6, резерв OTP_ATTEMPTS_EXCEEDED / OTP_EXPIRED). Удаляется на утилизации.
import type { OtpChannel } from '../../contract'

export const PROBE_OTP_CODE = '1234'
export const OTP_CODE_LENGTH = 4
export const OTP_CHANNEL: OtpChannel = 'sms'
/** Кулдаун повторной отправки — то, что мок реально умеет отклонять. */
export const OTP_RESEND_COOLDOWN_SEC = 30

// PROBE: лимита попыток нет — решение PM (§6). Неверный код можно вводить
// сколько угодно, верный после этого проходит.
export function isOtpValid(code: string): boolean {
  return code === PROBE_OTP_CODE
}

/** Сколько секунд осталось до разрешённой повторной отправки. */
export function resendRetryAfterSec(otpSentAt: string, now: Date): number {
  const elapsedSec = (now.getTime() - new Date(otpSentAt).getTime()) / 1000
  return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN_SEC - elapsedSec))
}
