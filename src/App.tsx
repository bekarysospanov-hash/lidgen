import { Route, Routes } from 'react-router-dom'
import Offers from './pages/client/Offers'
import SignIn from './pages/auth/SignIn'
import MyRequests from './pages/client/MyRequests'
import MasterProfileEdit from './pages/master/Profile'
import RequestCard from './pages/master/RequestCard'
import MasterRequests from './pages/master/Requests'
import Landing from './pages/public/Landing'
import MasterProfile from './pages/public/MasterProfile'
import Masters from './pages/public/Masters'
import RequestForm from './pages/public/RequestForm'
import Privacy from './pages/public/Privacy'
import LostLink from './pages/public/LostLink'
import RequestSent from './pages/public/RequestSent'

export default function App() {
  return (
    <Routes>
      {/*
        Заказчик — публичная зона. Главная с 20.09 — каталог: решение PM,
        каталог стал маркетплейсом и входом по умолчанию.

        Лендинг остался отдельным адресом и не удалён: он несёт оффер под
        рекламу и размечен UTM (US-01, US-26). Вести платный трафик в каталог
        вместо оффера — значит потерять то, что проба измеряет.
      */}
      <Route path="/" element={<Masters />} />
      <Route path="/promo" element={<Landing />} />
      <Route path="/masters" element={<Masters />} />
      <Route path="/masters/:id" element={<MasterProfile />} />
      <Route path="/request" element={<RequestForm />} />
      <Route path="/request/sent" element={<RequestSent />} />
      {/* US-11: политика открывается отдельной вкладкой, форма не теряется. */}
      <Route path="/privacy" element={<Privacy />} />
      {/* US-21 — вход для потерявшей ссылку: заявка есть, дойти до неё нечем. */}
      <Route path="/link" element={<LostLink />} />

      {/* Заказчица — по токену из ссылки, без регистрации (US-21).
          Кабинет её не отменяет: по ссылке заявку открывает и тот, кому
          её переслали, и тот, кто не хочет вводить никаких кодов. */}
      <Route path="/offers/:token" element={<Offers />} />

      {/* Вход — одна дверь на обе роли (решение PM 20.09). Роль решает
          сервер по номеру; /master остался адресом и ведёт на ту же дверь
          с подсказкой, куда человек шёл: на него ссылаются уведомления
          мебельщикам (US-15) и визитки, розданные до 20.09. */}
      <Route path="/login" element={<SignIn />} />
      <Route path="/master" element={<SignIn />} />

      {/* Кабинет заказчика (US-29) */}
      <Route path="/me" element={<MyRequests />} />
      <Route path="/me/requests" element={<MyRequests />} />

      {/* Кабинет мебельщика */}
      <Route path="/master/requests" element={<MasterRequests />} />
      <Route path="/master/requests/:id" element={<RequestCard />} />
      <Route path="/master/profile" element={<MasterProfileEdit />} />

      <Route path="*" element={<main className="p-2xl">Страница не найдена</main>} />
    </Routes>
  )
}
