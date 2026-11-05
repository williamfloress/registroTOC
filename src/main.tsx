import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './modules/finance/App'
import './styles.css'
import './accessible.css'
import './theme.css'
import './pwa.css'
import { registerServiceWorker } from './pwa'
import { applyTextScale } from './settings'

applyTextScale()
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)
