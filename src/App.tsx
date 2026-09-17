import { Route, Routes } from 'react-router-dom'
import Offers from './pages/client/Offers'
import MasterLogin from './pages/master/Login'
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
      {/* Заказчица — публичная зона */}
      <Route path="/" element={<Landing />} />
      <Route path="/masters" element={<Masters />} />
      <Route path="/masters/:id" element={<MasterProfile />} />
      <Route path="/request" element={<RequestForm />} />
      <Route path="/request/sent" element={<RequestSent />} />
      {/* US-11: политика открывается отдельной вкладкой, форма не теряется. */}
      <Route path="/privacy" element={<Privacy />} />
      {/* US-21 — вход для потерявшей ссылку: заявка есть, дойти до неё нечем. */}
      <Route path="/link" element={<LostLink />} />

      {/* Заказчица — по токену из ссылки, без регистрации (US-21) */}
      <Route path="/offers/:token" element={<Offers />} />

      {/* Мебельщик — кабинет */}
      <Route path="/master" element={<MasterLogin />} />
      <Route path="/master/requests" element={<MasterRequests />} />
      <Route path="/master/requests/:id" element={<RequestCard />} />
      <Route path="/master/profile" element={<MasterProfileEdit />} />

      <Route path="*" element={<main className="p-2xl">Страница не найдена</main>} />
    </Routes>
  )
}
