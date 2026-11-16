import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MobileNews } from './MobileNews'
import '../news-flow.css'
import './mobile.css'

createRoot(document.getElementById('root')!).render(<StrictMode><MobileNews /></StrictMode>)
