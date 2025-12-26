import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.tsx'
import { AuthProvider, BrigadeProvider } from './context'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <AuthProvider>
        <BrigadeProvider>
          <App />
        </BrigadeProvider>
      </AuthProvider>
    </HelmetProvider>
  </StrictMode>,
)
