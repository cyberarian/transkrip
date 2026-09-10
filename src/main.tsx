import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/atkinson-hyperlegible-next/latin-400.css'
import '@fontsource/atkinson-hyperlegible-next/latin-600.css'
import '@fontsource/atkinson-hyperlegible-next/latin-700.css'
import '@fontsource/chivo-mono/latin-400.css'
import '@fontsource/chivo-mono/latin-600.css'
import '@fontsource/chivo-mono/latin-700.css'
import { Root } from './Root'
import { applyAppearance, getAppearance } from './appearance'
import './styles.css'
import './studio.css'

applyAppearance(getAppearance())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
