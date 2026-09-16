import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'

// PROBE: превью-сборка для телефона. На статическом хостинге нет сервера,
// который отдаст index.html на произвольный путь, поэтому там роутер работает
// на хешах. В обычной сборке и на дев-сервере — обычные адреса, как и было.
const Router = import.meta.env.VITE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
)
