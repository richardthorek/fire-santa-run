import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider, BrigadeProvider } from './context'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrigadeProvider>
        <App />
      </BrigadeProvider>
    </AuthProvider>
  </StrictMode>,
)
