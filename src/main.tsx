import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import TaskOverlayHost from './features/tasks/components/TaskOverlayHost';
import './styles/TarlaPusulaTheme.css';
import './styles/MobileAppShell.css';
import './styles/WhiteAppTheme.css';
import './styles/MonochromeUI.css';
import './styles/MobileUiFixes.css';
import './styles/MobileAiUtilityFixes.css';
import './styles/MobileMapViewportFixes.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <TaskOverlayHost />
  </StrictMode>,
)
