import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { useAuth, useBrigade } from './context'
import { storageAdapter } from './storage'
import { initializeMockData } from './utils/mockData'

function App() {
  const [count, setCount] = useState(0)
  const [initialized, setInitialized] = useState(false)
  const { isAuthenticated, user, isLoading: authLoading } = useAuth()
  const { brigade, isLoading: brigadeLoading } = useBrigade()
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true'

  // Initialize mock data in dev mode
  useEffect(() => {
    const init = async () => {
      if (isDevMode && !initialized) {
        await initializeMockData(
          storageAdapter.saveBrigade.bind(storageAdapter),
          storageAdapter.saveRoute.bind(storageAdapter)
        )
        setInitialized(true)
      }
    }
    init()
  }, [isDevMode, initialized])

  if (authLoading || brigadeLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Fire Santa Run 🎅🚒</h1>
      
      {/* Dev Mode Indicator */}
      {isDevMode && (
        <div style={{ 
          backgroundColor: '#FFA726', 
          color: '#212121', 
          padding: '0.5rem 1rem', 
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          fontWeight: 'bold'
        }}>
          🛠️ Development Mode Active
        </div>
      )}

      {/* Auth & Brigade Info */}
      <div style={{ marginBottom: '2rem' }}>
        <h2>Phase 1: Infrastructure Setup Complete ✅</h2>
        <div style={{ textAlign: 'left', display: 'inline-block' }}>
          <p><strong>Authentication:</strong> {isAuthenticated ? '✅ Authenticated' : '❌ Not authenticated'}</p>
          {user && (
            <>
              <p><strong>User:</strong> {user.name || user.email}</p>
              <p><strong>Brigade ID:</strong> {user.brigadeId}</p>
            </>
          )}
          {brigade && (
            <p><strong>Brigade:</strong> {brigade.name}</p>
          )}
        </div>
      </div>

      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      
      <p className="read-the-docs">
        Phase 1 complete! Ready for Phase 2: Route Planning Interface
      </p>
    </>
  )
}

export default App
