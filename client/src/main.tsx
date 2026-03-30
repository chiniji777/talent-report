import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Apply saved font size
const savedFontSize = localStorage.getItem('talent-font-size');
if (savedFontSize) document.documentElement.style.fontSize = savedFontSize + 'px';

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
