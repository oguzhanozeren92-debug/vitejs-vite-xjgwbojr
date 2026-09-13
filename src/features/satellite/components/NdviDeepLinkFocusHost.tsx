import { useEffect } from 'react';

export default function NdviDeepLinkFocusHost() {
  useEffect(() => {
    const focusMap = () => {
      window.setTimeout(() => {
        const mapSection = document.querySelector('.tp-map-first-shell') as HTMLElement | null;
        if (!mapSection) return;

        mapSection.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

        mapSection.dataset.ndviDeepLinkFocus = '1';
        window.setTimeout(() => {
          delete mapSection.dataset.ndviDeepLinkFocus;
        }, 1800);
      }, 420);
    };

    window.addEventListener('tp:ndvi-deeplink-ready', focusMap);
    return () => {
      window.removeEventListener('tp:ndvi-deeplink-ready', focusMap);
    };
  }, []);

  return null;
}
