import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import TaskOverlayHost from './features/tasks/components/TaskOverlayHost';
import FieldOperationHost from './features/field-operations/components/FieldOperationHost';
import NdviDeepLinkFocusHost from './features/satellite/components/NdviDeepLinkFocusHost';
import { installDataAuthorityNetworkGuard } from './features/data-bridge/dataAuthorityNetworkGuard';
import './styles/TarlaPusulaTheme.css';
import './styles/MobileAppShell.css';
import './styles/WhiteAppTheme.css';
import './styles/MonochromeUI.css';
import './styles/MobileUiFixes.css';
import './styles/MobileAiUtilityFixes.css';
import './styles/MobileMapViewportFixes.css';
import './styles/TarlaPusulaProfessionalSystem.css';
import './styles/TarlaPusulaProfessionalRoutes.css';
import './styles/UiRegressionFixes.css';
import './styles/NotificationReadabilityFix.css';

// Eski componentlerde kalan ikinci harita-veri fallback yolları uygulama başında
// devre dışı bırakılır. Her metrik yalnız merkezi data bridge/otoritesini kullanır.
installDataAuthorityNetworkGuard();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <TaskOverlayHost />
    <FieldOperationHost />
    <NdviDeepLinkFocusHost />
  </StrictMode>,
)
