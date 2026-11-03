import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './modules/finance/App'
import './styles.css'
import './accessible.css'
import './theme.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)
