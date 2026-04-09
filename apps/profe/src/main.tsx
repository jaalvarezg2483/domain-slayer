import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initTheme } from './lib/theme'
import {
  installBrowserElectronMock,
  trySyncInventoryJwtSession,
} from './lib/browser-electron-mock'

initTheme()

if (typeof window !== 'undefined' && !window.electronAPI) {
  installBrowserElectronMock()
  trySyncInventoryJwtSession()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

