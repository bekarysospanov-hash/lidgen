import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { HASH_ROUTER } from './router-mode'
import { trackVisit } from './analytics'

// PROBE: превью-сборка для телефона. На статическом хостинге нет сервера,
// который отдаст index.html на произвольный путь, поэтому там роутер работает
// на хешах. В обычной сборке и на дев-сервере — обычные адреса, как и было.
// Признак живёт в router-mode.ts: ссылку на предложения собирает страница
// «заявка принята», и она обязана знать о режиме то же самое.
const Router = HASH_ROUTER ? HashRouter : BrowserRouter

// PROBE: демо-заявки в дев-режиме и в превью — кабинет мебельщика иначе
// открывается пустым при каждой перезагрузке, и смотреть в нём нечего.
// На боевой сборке с реальным бэком не выполняется.
if (import.meta.env.VITE_USE_MOCKS !== 'false') {
  void import('./probe-seed').then((module) => module.seedProbeRequests())
}

// US-25a: первое событие воронки. Пишется до рендера — человек уже пришёл,
// независимо от того, что и как быстро нарисуется.
trackVisit()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
)
