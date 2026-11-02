import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StoreProvider } from './data/store'
import { UIProvider } from './components/ui'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <UIProvider>
          <App />
        </UIProvider>
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>,
)
