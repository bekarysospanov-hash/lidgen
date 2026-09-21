// Сквозной путь заявки: форма → код → кабинет → вилка → страница клиента.
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

/**
 * Ответ вилкой на заявку, узнаваемую по размеру. Состав отмечается чипсами
 * (контракт §2, решение 17.09), «что не входит» обязательно.
 *
 * Две мастерские отвечают РАЗНЫМ составом намеренно: в этом весь смысл US-23.
 * Одинаковые наборы дали бы зелёный тест и бесполезный снимок — матрица,
 * в которой все строки одинаковы, ничего не объясняет про разницу в цене.
 */
async function ответить(
  page: Page,
  отКзт: string,
  доКзт: string,
  дней: string,
  состав: string[],
  неВходит: string,
  /**
   * Материалы цеховыми подписями — так они названы в форме мебельщика
   * (заказчица прочитает те же значения простыми словами). Необязательны:
   * КП без материалов остаётся законным, и один из двух ответов ниже
   * их не называет нарочно — сравнение обязано это показывать.
   */
  материалы: string[] = [],
) {
  await page.locator('a[href^="/master/requests/"]', { hasText: РАЗМЕР }).first().click()
  // Строки состава нажимаются по видимой подписи: сам checkbox sr-only, и
  // Playwright его не нажмёт — та же причина, что у строк выбора в форме
  // клиента. Чипсами состав был до 18.09, пока не упёрся в длину подписей.
  for (const позиция of состав) {
    await page.locator('label', { hasText: позиция }).first().click()
  }
  for (const материал of материалы) {
    await page.locator('label', { hasText: материал }).first().click()
  }
  await page.locator('#excluded').fill(неВходит)
  // Поля цены адресуются по id: подписи «от» и «до» коротки и встречаются
  // в других метках экрана, а id у них устойчивы и осмысленны.
  await page.locator('#priceFrom').fill(отКзт)
  await page.locator('#priceTo').fill(доКзт)
  await page.locator('#leadTime').fill(дней)
  await page.getByRole('button', { name: 'Отправить ответ' }).click()
  await expect(page.getByRole('heading', { name: 'Ответ отправлен' })).toBeVisible()
}

test('заявка доходит от формы до вилки на странице клиента @shots', async ({ page }) => {
  // Лендинг с 20.09 живёт на /promo: главная отдана каталогу (решение PM).
  // Оффер остался отдельным адресом — на него ведёт реклама, и проба
  // измеряет именно его.
  await page.goto('/promo')

  // 1 · Лендинг: каталог пуст, значит блока о мастерских быть не должно (US-02)
  await expect(page.getByRole('heading', { name: 'Смотрите пробу?' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Смотреть мастерские' })).toHaveCount(0)
  await снимок(page, 'лендинг')

  // 2 · Форма заявки
  await черезПробу(page, /Путь клиента/)
  // Кликаем по видимой строке, а не по скрытому input: sr-only-поле
  // Playwright не нажмёт, да и человек нажимает строку целиком.
  await page.getByText('Кухня', { exact: true }).click()
  await page.getByLabel('Сколько метров вдоль стены?').fill(РАЗМЕР)
  await page.getByText('Угловая', { exact: true }).click()
  await page.getByText('Да, встроенную', { exact: true }).click()
  await page
    .getByLabel('Расскажите своими словами')
    .fill('Кухня в новостройке, окно по центру стены')
  await page.getByText('Стандарт', { exact: true }).click()
  // Вопроса о сроке в форме больше нет: поле deadline удалено из контракта
  // 18.09 — мебельщик всё равно называет свой срок в ответе.
  await page.getByText('Алматы', { exact: true }).click()
  await page.getByLabel('ЖК или район').fill('ЖК Есентай')
  await page.getByLabel('Куда прислать ответ?').fill('7012468024')

  // 3 · Без согласия отправки нет (US-11) — проверка до того, как отметим
  await page.getByRole('button', { name: 'Отправить заявку' }).click()
  await expect(page.getByText('Без согласия заявку отправить нельзя')).toBeVisible()

  await снимок(page, 'форма-заполнена')
  await page.getByText('Согласен на обработку своих данных').click()
  await page.getByRole('button', { name: 'Отправить заявку' }).click()

  // 4 · Код
  await expect(page.getByRole('heading', { name: 'Подтвердите номер' })).toBeVisible()
  await page.getByLabel('Код из сообщения').fill(КОД)
  await page.getByRole('button', { name: 'Подтвердить' }).click()
  await expect(page.getByRole('heading', { name: 'Заявка принята' })).toBeVisible()
  // Маршрутизация случилась: статус уже не «ждём подтверждения» (US-14)
  await expect(page.getByText('Заявка у мебельщиков')).toBeVisible()
  await снимок(page, 'заявка-принята')

  // 4б · Потерянная ссылка (US-21). Проверяется переходом внутри приложения,
  // а не goto: моки держат состояние в памяти вкладки, и перезагрузка стёрла бы
  // заявку вместе с предложениями — тест мерил бы не то.
  await page.getByRole('link', { name: 'Потеряете ссылку — пришлём заново' }).click()
  await page.getByLabel('Куда прислать ответ?').fill('7012468024')
  await page.getByRole('button', { name: 'Прислать ссылку' }).click()
  await expect(page.getByRole('heading', { name: 'Отправили' })).toBeVisible()
  await снимок(page, 'ссылка-отправлена-заново')
  // PROBE: мессенджера в пробе нет, и ссылка показывается на месте.
  await page.getByRole('link', { name: 'Открыть предложения' }).click()
  await expect(page.getByText('Предложений пока нет')).toBeVisible()
  await page.goBack()
  await page.goBack()

  // 5 · Первый мебельщик отвечает
  // Панель пробы живёт на лендинге, а он с 20.09 на /promo: знак в шапке
  // ведёт на главную, то есть в каталог. Переход ссылкой, не goto: мок-стор
  // живёт в памяти вкладки, и перезагрузка обнулила бы заявку.
  // Панель пробы живёт на лендинге, а он с 20.09 на /promo. Переход идёт
  // ссылкой из подвала, а не goto: мок-стор живёт в памяти вкладки,
  // и перезагрузка обнулила бы заявку на середине пути.
  await page.getByRole('link', { name: 'Как это работает' }).click()
  await черезПробу(page, /Путь мебельщика/)
  await войти(page, МАСТЕР_ОДИН)
  await page.getByRole('link', { name: new RegExp(РАЗМЕР) }).first().click()
  // Телефона для связи до ответа нет — требование ПДн, а не деталь экрана (§7).
  // Проверяется и по сырой строке, и по показу группами: с 21.09 номер
  // выводится читаемым, и проверка одного написания пропустила бы утечку.
  await expect(page.getByText('+77012468024')).toHaveCount(0)
  await expect(page.getByText('+7 (701) 246-80-24')).toHaveCount(0)
  // Снимок делается после того, как форма отрисовалась: иначе он ловит
  // «Открываем заявку» и не доказывает ничего — так и было до 17.09.
  await expect(page.getByText('Что из этого в цене?')).toBeVisible()
  await снимок(page, 'карточка-у-мебельщика')
  await page.goBack()
  await ответить(
    page,
    '950000',
    '1250000',
    '30',
    // Дешёвая вилка: в цене почти ничего сверх самой мебели.
    ['Мойка и сушилка', 'Доставка'],
    'Замер и подъём на этаж — отдельно. Сборка по счёту после замера.',
    ['МДФ в плёнке', 'ЛДСП'],
  )
  // ...и ровно теперь он появился — группами, а в tel: формат контракта
  await expect(page.getByText('+7 (701) 246-80-24')).toBeVisible()
  await expect(page.locator('a[href="tel:+77012468024"]').first()).toBeVisible()
  await снимок(page, 'ответ-отправлен-телефон-открылся')

  // 5б · Своя карточка (US-20). До неё из кабинета не было ссылки вовсе,
  // и мебельщик не видел, что о нём написано в каталоге. У первой мастерской
  // с 18.09 лежит демонстрационная карточка (PROBE) — иначе экран нельзя
  // посмотреть с данными. Состояние «готовим вашу карточку» осталось
  // у остальных шести и проверяется отдельным тестом ниже.
  await page.getByRole('link', { name: 'Профиль' }).click()
  await expect(page.getByRole('heading', { name: 'Ваша карточка' })).toBeVisible()
  // Обзор, а не анкета (правка 20.09): поле «О мастерской» живёт стадией
  // правки, а первым открывается то, что видит заказчик.
  await expect(page.getByRole('heading', { name: 'Так вас видят в каталоге' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Открыть свою карточку в каталоге' })).toBeVisible()
  await снимок(page, 'своя-карточка-мебельщика')
  await page.getByRole('button', { name: 'Редактировать карточку' }).click()
  // Разделы анкеты свёрнуты (правка 20.09): их девять, и в один проход
  // форма шла на 5600 пикселей. Поле живёт внутри своего раздела.
  await page.getByRole('button', { name: /О мастерской/ }).click()
  await expect(page.getByLabel('О мастерской')).toBeVisible()
  await page.getByRole('button', { name: 'Отменить' }).click()
  await page.goBack()

  // 6 · Правка вместо второго КП (US-19b)
  await page.getByRole('button', { name: 'Поправить ответ' }).click()
  await page.locator('#priceTo').fill('1100000')
  await page.getByRole('button', { name: 'Отправить исправленный ответ' }).click()
  await expect(page.getByText('Исправлено')).toBeVisible()
  await снимок(page, 'кп-исправлено')

  // 7 · Выход и вход второй мастерской. Дверь с 20.09 одна на обе роли,
  // и заголовок у неё нейтральный: «Вход для мастерских» на общей двери
  // сказал бы заказчице, что ей сюда нельзя.
  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(page.getByRole('heading', { name: 'Вход', exact: true })).toBeVisible()
  await войти(page, МАСТЕР_ДВА)
  await ответить(
    page,
    '1300000',
    '1700000',
    '45',
    // Дорогая вилка: в цене всё, включая работы. В этом и смысл US-23 —
    // разница между предложениями лежит не в фасадах, а в том, что внутри.
    [
      'Мойка и сушилка',
      'Доводчики на дверцах',
      'Подсветка',
      'Замер',
      'Доставка',
      'Подъём на этаж',
      'Сборка и установка',
    ],
    'Ничего сверх вилки: замер, подъём и сборка уже внутри.',
    ['Крашеный МДФ', 'Искусственный камень', 'Делаем'],
  )

  // 8 · Глазами клиента: два предложения, сравнение, контакт.
  // Панель пробы со ссылкой на свою заявку живёт на лендинге (/promo),
  // и знак в шапке ведёт теперь в каталог — идём подвалом.
  await page.getByRole('link', { name: 'Капибара' }).click()
  await page.getByRole('link', { name: 'Как это работает' }).click()
  await page.getByRole('link', { name: /Предложения по вашей заявке/ }).click()

  await expect(page.getByText('Изменено')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Чем отличаются' })).toBeVisible()
  await expect(page.getByText('950 000 – 1 100 000 ₸').first()).toBeVisible()
  await expect(page.getByText('1 300 000 – 1 700 000 ₸').first()).toBeVisible()

  // Матрица US-23: разница видна механически, а не вычитыванием двух абзацев.
  // «Замер» у одного есть, у другого нет — ровно та строка, из-за которой
  // и расходится цена на 350 тысяч.
  const строкаЗамер = page.getByRole('row', { name: /Замер/ })
  await expect(строкаЗамер.getByText('есть')).toHaveCount(1)
  await expect(строкаЗамер.getByText('нет')).toHaveCount(1)

  // Телефоны скрыты, пока не нажали (US-24). Проверяются оба написания:
  // с 21.09 номер показывается группами, и одной строкой утечку не поймать.
  await expect(page.getByText('+77010000001')).toHaveCount(0)
  await expect(page.getByText('+7 (701) 000-00-01')).toHaveCount(0)
  await снимок(page, 'предложения-и-сравнение')
  await page.getByRole('button', { name: 'Показать телефон' }).first().click()
  await expect(page.getByText('+7 (701) 000-00-01')).toBeVisible()
  await expect(page.locator('a[href="tel:+77010000001"]').first()).toBeVisible()
  await снимок(page, 'контакт-раскрыт')
})

test('нерабочая ссылка больше не тупик: из неё есть выход @shots', async ({ page }) => {
  // US-21. Раньше экран говорил «ссылка не работает» и заканчивался на этом,
  // хотя заявка и предложения по ней никуда не делись.
  await page.goto('/offers/этой-ссылки-нет')
  await expect(page.getByRole('heading', { name: 'Ссылка не работает' })).toBeVisible()
  await page.getByRole('link', { name: 'Прислать ссылку заново' }).click()
  await expect(page.getByRole('heading', { name: 'Пришлём ссылку заново' })).toBeVisible()
  await снимок(page, 'потерянная-ссылка')
})

test('карточка мастерской без согласия не существует для внешнего мира @shots', async ({ page }) => {
  // US-03. Мастерская в списке есть, карточки у неё нет — ответ тот же, что
  // для несуществующей: приём заявок и публикация разные решения. Человека
  // при этом нельзя оставлять в тупике, отсюда объяснение и выход на форму.
  // Третья: у первых двух с 18.09 лежат демонстрационные карточки (PROBE).
  await page.goto('/masters/aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3')
  await expect(page.getByRole('heading', { name: 'Такой мастерской нет в каталоге' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Оставить заявку' })).toBeVisible()
  await снимок(page, 'мастерской-нет-в-каталоге')
})

test('опубликованная карточка открывается целиком — US-03 @shots', async ({ page }) => {
  // Первая мастерская — заполненная карточка (PROBE, 18.09). Проверяется
  // не только заголовок: карточка обязана показать, что входит в работу,
  // сроки и разбитые по виду работы снимки — ради этого её и открывают.
  await page.goto('/masters/aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
  await expect(page.getByRole('heading', { name: 'Мастерская на Сайране' })).toBeVisible()
  await expect(page.getByText('Кухни', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Услуги мастерской' })).toBeVisible()
  await expect(page.getByText('Замер на месте')).toBeVisible()
  await expect(page.getByText('от 25 до 35 дней')).toBeVisible()
  await expect(page.getByText('Шкафы и гардеробные')).toBeVisible()
  // Два пути дальше (решение PM 21.09): расчёт по заявке и связь.
  // Телефон раскрывается по нажатию, а не лежит открытым.
  await expect(page.getByRole('link', { name: 'Получить расчёт' }).first()).toBeVisible()
  await expect(page.getByText('+77010000001')).toHaveCount(0)
  await page.getByRole('button', { name: 'Телефон' }).first().click()
  // Показывается группами, а в tel: уходит формат контракта.
  await expect(page.getByRole('link', { name: '+7 (701) 000-00-01' }).first()).toBeVisible()
  await expect(page.locator('a[href="tel:+77010000001"]').first()).toBeVisible()
  // Отзывов в пробе не будет, и раздел говорит это словами.
  await expect(page.getByRole('heading', { name: 'Отзывы' })).toBeVisible()
  // Безопасная покупка помечена будущей: механизма расчётов нет, и окно
  // говорит, чем это станет и как происходит сейчас.
  await page.getByRole('button', { name: 'Как это будет' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Деньги будут замораживаться')).toBeVisible()
  await page.getByRole('button', { name: 'Понятно' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('img').first()).toBeVisible()
  await снимок(page, 'карточка-мастерской-заполненная')
})

test('каталог показывает опубликованную карточку @shots', async ({ page }) => {
  // Пустой каталог со словами «Каталог ещё собирается» проверялся до 18.09,
  // пока карточек не было ни одной. Теперь их три (PROBE), и проверяется
  // обратное: витрина показывает опубликованное и ведёт в карточку.
  await page.goto('/masters')
  await expect(page.getByText('Мастерская на Сайране')).toBeVisible()
  await expect(page.getByRole('link', { name: /Мастерская на Сайране/ }).first()).toBeVisible()
  // Шильдик на плитке несёт факт, который мастерская сказала о себе сама
  // (§ Components): на витрине это единственная метка.
  await expect(page.getByText('Замер на месте').first()).toBeVisible()
  // Плитка витрины (правка 20.09) держит только то, по чему выбирают
  // за один взгляд: город и срок. Гарантия, услуги и рассказ — в карточке,
  // на 165 пикселях столбика им места нет.
  await expect(page.getByText('от 25 до 35 дней').first()).toBeVisible()
  // Отзывов в пробе нет, и место под оценку занято честной строкой:
  // выдуманное число рейтинга система запрещает (§ Presence).
  await expect(page.getByText('Пока нет отзывов').first()).toBeVisible()
  await page.screenshot({ path: `${ПАПКА}/09-каталог.png`, fullPage: true })
})

/**
 * US-20 — запись, а не чтение. До 18.09 каталог проверялся только на чтение:
 * шесть сценариев открывали карточку, и ни один не проверял, что правка
 * мебельщика до неё доезжает. Это самый новый экран сессии, и держался он
 * на одних скриншотах.
 *
 * Страница не перезагружается: мок-сессии живут в памяти вкладки, и переход
 * в каталог идёт ссылкой шапки, как у человека.
 */
test('мебельщик правит карточку — и правка видна в каталоге @shots', async ({ page }) => {
  await page.goto('/master')
  await войти(page, МАСТЕР_ОДИН)
  await page.getByRole('link', { name: 'Профиль' }).click()

  // Карточка открывается обзором, а не анкетой (правка 20.09): первое,
  // что видит мебельщик, — плитка, какой его видит заказчик.
  await expect(page.getByRole('heading', { name: 'Так вас видят в каталоге' })).toBeVisible()
  await снимок(page, 'кабинет-моя-карточка')
  await page.getByRole('button', { name: 'Редактировать карточку' }).click()

  // Разделы свёрнуты (правка 20.09): открываем те, в которых правим.
  // Раздела «Чем отличаетесь» с 21.09 нет вовсе: поле снято из контракта,
  // потому что заказчик его нигде не видел.

  // Условие услуги — то, ради чего услуги вообще стали объектами: «в цене»
  // и «отдельно» должны доезжать до каталога по отдельности (контракт §2).
  await page.getByRole('button', { name: /Что обычно входит в цену/ }).click()
  await page.locator('label', { hasText: 'Разбираю и вывожу старую' }).first().click()
  // Условие ищется внутри группы своей услуги: чипсов «Отдельно» на экране
  // столько же, сколько отмеченных услуг, и «последний» — не признак.
  await page
    .getByRole('group', { name: 'Разбираю и вывожу старую' })
    .locator('label', { hasText: 'Отдельно' })
    .click()

  await page.getByRole('button', { name: 'Сохранить карточку' }).click()
  await expect(page.getByText('Сохранили. В каталоге это появится сразу.')).toBeVisible()
  await снимок(page, 'карточка-мебельщика-сохранена')

  // В кабинете своя шапка, публичной навигации в ней нет — выходим знаком
  // сервиса, как это делает человек: он жмёт на логотип и попадает домой.
  await page.getByRole('link', { name: 'Капибара' }).click()
  await черезПробу(page, 'Мастерские')
  await page.waitForURL('**/masters')
  // Заголовка у витрины нет вовсе (решение PM 20.09): страница поиска
  // начинается списком, а не рассказом. Признак, что мы на ней, —
  // строка поиска и счётчик найденных.
  await expect(page.getByPlaceholder('Мастерская или что нужно')).toBeVisible()
  await expect(page.getByText('3 мастерские')).toBeVisible()
  // Плитка витрины нажимается целиком (§ Components): отдельной ссылки
  // «Смотреть работы» в ней нет — человек метит в карточку, а не в строку.
  await page.getByRole('link', { name: /Мастерская на Сайране/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Мастерская на Сайране' })).toBeVisible()
  // Отличия своими словами с 21.09 на карточке не показываются (решение PM:
  // блок «Ещё про эту мастерскую» снят). Правка проверяется по услуге —
  // она доезжает до каталога вместе с условием.
  await expect(page.getByText('Уберёт старую мебель — за отдельную плату')).toBeVisible()

  // Телефон мастерской в каталог не уходит вовсе (контракт §2): он вырезан
  // схемой, а не спрятан показом, и в теле ответа его тоже нет.
  await expect(page.getByText('+7701')).toHaveCount(0)
  await снимок(page, 'правка-доехала-до-каталога')
})

/**
 * US-02 — каталог отбирает, а не просто перечисляет. Отбор живёт в адресе:
 * человек уходит в карточку и возвращается кнопкой браузера, и его выбор
 * на этом переходе теряться не должен.
 */
test('каталог отбирает по виду работ и городу, отбор переживает возврат @shots', async ({ page }) => {
  await page.goto('/masters')
  await expect(page.getByText('3 мастерские')).toBeVisible()

  // Отбор свёрнут по умолчанию (правка 20.09): два ряда чипсов занимали
  // на телефоне весь первый экран, и до первой плитки приходилось листать.
  await page.getByRole('button', { name: 'Фильтры' }).click()

  // Ванную отметила одна мастерская, и она в Алматы. Пара «ванная + Шымкент»
  // не даёт никого — это не пустой каталог, и экран обязан сказать разницу
  // словами, а не показать пустоту.
  await page.getByRole('button', { name: 'Ванная' }).click()
  await page.getByRole('button', { name: 'Шымкент' }).click()
  await expect(page.getByRole('heading', { name: 'Под этот выбор никого' })).toBeVisible()
  await снимок(page, 'каталог-отбор-пуст')

  await page.getByRole('button', { name: 'Показать всех' }).click()
  await page.getByRole('button', { name: 'Шкафы' }).click()
  await page.getByRole('button', { name: 'Алматы' }).click()
  await expect(page).toHaveURL(/kind=wardrobe/)
  await expect(page).toHaveURL(/city=almaty/)
  await expect(page.getByText('2 мастерские')).toBeVisible()
  await снимок(page, 'каталог-отобран')

  // Плитка витрины нажимается целиком (§ Components): отдельной ссылки
  // «Смотреть работы» в ней нет — человек метит в карточку, а не в строку.
  await page.getByRole('link', { name: /Мастерская на Сайране/ }).first().click()
  await expect(page.getByRole('link', { name: 'Все мастерские' })).toBeVisible()
  await page.goBack()
  // Отбор на месте — и в адресе, и на чипсах.
  await expect(page).toHaveURL(/kind=wardrobe&city=almaty/)
  await expect(page.getByText('2 мастерские')).toBeVisible()
})

test('политика открывается и честно помечена черновиком @shots', async ({ page }) => {
  await page.goto('/privacy')
  await expect(
    page.getByRole('heading', { name: 'Политика обработки персональных данных' }),
  ).toBeVisible()
  await expect(page.getByText('Текст не прошёл юридическую проверку')).toBeVisible()
  await page.screenshot({ path: `${ПАПКА}/10-политика-черновик.png`, fullPage: true })
})

/**
 * US-29, §5в — одна дверь на обе роли (решение PM 20.09). Сценарий проверяет
 * то, ради чего дверь и сводили в одну: человек, не состоящий в реестре
 * мастерских, не упирается в тупик, а входит заказчиком и видит свои заявки.
 *
 * Страница не перезагружается: мок-стор живёт в памяти вкладки, и заявка,
 * оставленная в начале, должна дожить до кабинета.
 */
test('заказчик входит той же дверью и видит свою заявку в кабинете @shots', async ({ page }) => {
  await page.goto('/request')

  // 1 · Заявка. Тот же путь, что и в главном сценарии, но короче.
  await page.getByText('Кухня', { exact: true }).click()
  await page.getByLabel('Сколько метров вдоль стены?').fill('2,8')
  await page.getByText('Прямая', { exact: true }).click()
  await page.getByText('Пока не решили', { exact: true }).click()
  await page.getByLabel('Расскажите своими словами').fill('Небольшая кухня, окно слева')
  await page.getByText('Эконом', { exact: true }).click()
  await page.getByText('Алматы', { exact: true }).click()
  await page.getByLabel('Куда прислать ответ?').fill('7051112233')
  await page.getByText('Согласен на обработку своих данных').click()
  await page.getByRole('button', { name: 'Отправить заявку' }).click()
  await page.getByLabel('Код из сообщения').fill(КОД)
  await page.getByRole('button', { name: 'Подтвердить' }).click()
  await expect(page.getByRole('heading', { name: 'Заявка принята' })).toBeVisible()

  // 2 · Вход тем же номером — той же дверью, что и мебельщик.
  await page.getByRole('link', { name: 'Капибара' }).click()
  await page.getByRole('link', { name: 'Войти' }).first().click()
  await expect(page.getByRole('heading', { name: 'Вход', exact: true })).toBeVisible()
  await снимок(page, 'вход-одна-дверь')
  await page.getByLabel('Номер телефона').fill('+7 (705) 111-22-33')
  await page.getByRole('button', { name: 'Получить код' }).click()
  await page.getByLabel('Код из сообщения').fill(КОД)
  await page.getByRole('button', { name: 'Войти' }).click()

  // 3 · Кабинет заказчика: заявка, оставленная ДО входа, здесь сама.
  await expect(page.getByRole('heading', { name: 'Мои заявки' })).toBeVisible()
  await expect(page.getByText('Кухня, 2,8 метра')).toBeVisible()
  await expect(page.getByText('Предложений пока нет')).toBeVisible()
  await снимок(page, 'кабинет-заказчика')

  // 4 · Дверь мастерской заказчику объясняют словами, а не тупиком.
  await page.goto('/master')
  await expect(page.getByRole('heading', { name: 'Вы вошли как заказчик' })).toBeVisible()
  await снимок(page, 'заказчик-на-двери-мастерской')
})
