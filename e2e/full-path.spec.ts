// Сквозной путь заявки: форма → код → кабинет → вилка → страница заказчицы.
// Единственный автотест интерфейса (см. playwright.config.ts, там же причина).
//
// Правило прохода, из которого всё следует: **страница не перезагружается
// до конца сценария**. Сервера у пробы нет, заявки живут в памяти вкладки,
// и reload обнулил бы всё на середине. Поэтому переходы — только кликами,
// как их делает человек.
import { expect, test, type Page } from '@playwright/test'

/**
 * Снимки экранов кладутся файлами, а не остаются в панели: панель дважды
 * за сессию 17.09 отдала пустые кадры, и PM не увидел ни одного экрана.
 * Файл можно отправить, и он дойдёт.
 */
const ПАПКА = 'e2e/shots'
let счёт = 0
async function снимок(page: Page, имя: string) {
  счёт += 1
  await page.screenshot({
    path: `${ПАПКА}/${String(счёт).padStart(2, '0')}-${имя}.png`,
    fullPage: true,
  })
}

/** Мебельщики из мок-списка. Настоящих номеров здесь нет и не будет. */
const МАСТЕР_ОДИН = '+7 (701) 000-00-01'
const МАСТЕР_ДВА = '+7 (701) 000-00-02'
const КОД = '1234'
/** Размер, по которому заявка узнаётся в списках кабинета. */
const РАЗМЕР = '3,6'

async function черезПробу(page: Page, дверь: string) {
  await page.getByRole('link', { name: дверь }).click()
}

/** Вход мебельщика: номер → код → кабинет. */
async function войти(page: Page, номер: string) {
  await page.getByLabel('Номер телефона').fill(номер)
  await page.getByRole('button', { name: 'Получить код' }).click()
  await page.getByLabel('Код из сообщения').fill(КОД)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('heading', { name: 'Заявки' })).toBeVisible()
}

/** Ответ вилкой на заявку, узнаваемую по размеру. */
async function ответить(page: Page, отКзт: string, доКзт: string, дней: string) {
  await page.locator('a[href^="/master/requests/"]', { hasText: РАЗМЕР }).first().click()
  // Поля формы КП адресуются по id: подписи «от» и «до» коротки и встречаются
  // в других метках экрана, а id у них устойчивы и осмысленны.
  await page.locator('#composition').fill('Тумбы, верх до потолка, столешница')
  await page.locator('#materials').fill('Плотные корпуса, матовые фасады без ручек')
  await page.locator('#priceFrom').fill(отКзт)
  await page.locator('#priceTo').fill(доКзт)
  await page.locator('#leadTime').fill(дней)
  await page.getByRole('button', { name: 'Отправить ответ' }).click()
  await expect(page.getByRole('heading', { name: 'Ответ отправлен' })).toBeVisible()
}

test('заявка доходит от формы до вилки на странице заказчицы @shots', async ({ page }) => {
  await page.goto('/')

  // 1 · Лендинг: каталог пуст, значит блока о мастерских быть не должно (US-02)
  await expect(page.getByRole('heading', { name: 'Смотрите пробу?' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Смотреть мастерские' })).toHaveCount(0)
  await снимок(page, 'лендинг')

  // 2 · Форма заказчицы
  await черезПробу(page, /Путь заказчицы/)
  // Кликаем по видимой строке, а не по скрытому input: sr-only-поле
  // Playwright не нажмёт, да и человек нажимает строку целиком.
  await page.getByText('Кухня', { exact: true }).click()
  await page.getByLabel('Сколько метров вдоль стены?').fill(РАЗМЕР)
  await page.getByText('Угловая', { exact: true }).click()
  await page.getByText('Да, встроенную', { exact: true }).click()
  await page
    .getByLabel('Расскажите своими словами')
    .fill('Кухня в новостройке, окно по центру стены')
  await page.getByText('Средняя', { exact: true }).click()
  await page.getByText('К определённой дате', { exact: true }).click()
  await page.getByLabel('К какой дате').fill('к Новому году')
  await page.getByText('Алматы', { exact: true }).click()
  await page.getByLabel('ЖК или район').fill('ЖК Есентай')
  await page.getByLabel('Куда прислать ответ?').fill('7012468024')

  // 3 · Без согласия отправки нет (US-11) — проверка до того, как отметим
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await expect(page.getByText('Без согласия заявку отправить нельзя')).toBeVisible()

  await снимок(page, 'форма-заполнена')
  await page.getByText('Согласен на обработку своих данных').click()
  await page.getByRole('button', { name: 'Продолжить' }).click()

  // 4 · Код
  await expect(page.getByRole('heading', { name: 'Подтвердите номер' })).toBeVisible()
  await page.getByLabel('Код из сообщения').fill(КОД)
  await page.getByRole('button', { name: 'Подтвердить' }).click()
  await expect(page.getByRole('heading', { name: 'Заявка принята' })).toBeVisible()
  // Маршрутизация случилась: статус уже не «ждём подтверждения» (US-14)
  await expect(page.getByText('Заявка у мебельщиков')).toBeVisible()
  await снимок(page, 'заявка-принята')

  // 5 · Первый мебельщик отвечает
  await page.getByRole('link', { name: 'Капибара' }).click()
  await черезПробу(page, /Путь мебельщика/)
  await войти(page, МАСТЕР_ОДИН)
  await page.getByRole('link', { name: new RegExp(РАЗМЕР) }).first().click()
  // Телефона заказчицы до ответа нет — требование ПДн, а не деталь экрана (§7)
  await expect(page.getByText('+77012468024')).toHaveCount(0)
  await снимок(page, 'карточка-у-мебельщика')
  await page.goBack()
  await ответить(page, '950000', '1250000', '30')
  // ...и ровно теперь он появился
  await expect(page.getByText('+77012468024')).toBeVisible()
  await снимок(page, 'ответ-отправлен-телефон-открылся')

  // 6 · Правка вместо второго КП (US-19b)
  await page.getByRole('button', { name: 'Поправить ответ' }).click()
  await page.locator('#priceTo').fill('1100000')
  await page.getByRole('button', { name: 'Отправить исправленный ответ' }).click()
  await expect(page.getByText('Исправлено')).toBeVisible()
  await снимок(page, 'кп-исправлено')

  // 7 · Выход и вход второй мастерской
  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(page.getByRole('heading', { name: 'Вход для мастерских' })).toBeVisible()
  await войти(page, МАСТЕР_ДВА)
  await ответить(page, '1300000', '1700000', '45')

  // 8 · Глазами заказчицы: два предложения, сравнение, контакт
  await page.getByRole('link', { name: 'Капибара' }).click()
  await page.getByRole('link', { name: /Предложения по вашей заявке/ }).click()

  await expect(page.getByText('Изменено')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Чем отличаются' })).toBeVisible()
  await expect(page.getByText('950 000 – 1 100 000 ₸').first()).toBeVisible()
  await expect(page.getByText('1 300 000 – 1 700 000 ₸').first()).toBeVisible()

  // Телефоны скрыты, пока не нажали (US-24)
  await expect(page.getByText('+77010000001')).toHaveCount(0)
  await снимок(page, 'предложения-и-сравнение')
  await page.getByRole('button', { name: 'Показать телефон' }).first().click()
  await expect(page.getByText('+77010000001')).toBeVisible()
  await снимок(page, 'контакт-раскрыт')
})

test('каталог пуст и говорит об этом словами @shots', async ({ page }) => {
  await page.goto('/masters')
  await expect(page.getByRole('heading', { name: 'Каталог ещё собирается' })).toBeVisible()
  await expect(page.getByText('Придуманных карточек здесь не будет')).toBeVisible()
  await page.screenshot({ path: `${ПАПКА}/09-каталог-пуст.png`, fullPage: true })
})

test('политика открывается и честно помечена черновиком @shots', async ({ page }) => {
  await page.goto('/privacy')
  await expect(
    page.getByRole('heading', { name: 'Политика обработки персональных данных' }),
  ).toBeVisible()
  await expect(page.getByText('Текст не прошёл юридическую проверку')).toBeVisible()
  await page.screenshot({ path: `${ПАПКА}/10-политика-черновик.png`, fullPage: true })
})
