import { useState, useEffect } from 'react';

export type InterfaceMode = 'mobile' | 'pc';

export function useDeviceMode() {
  // Check user preference or detect from screen width / user agent / standalone mode
  // Default to 'mobile' so user directly experiences the Android mobile app
  const [preferredMode, setPreferredMode] = useState<'auto' | 'mobile' | 'pc'>(() => {
    try {
      const saved = localStorage.getItem('vigilytics_interface_mode');
      if (saved === 'mobile' || saved === 'pc' || saved === 'auto') return saved;
    } catch {
      // ignore
    }
    return 'mobile';
  });

  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 420
  );

  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);

    // Check standalone PWA installation status
    const checkStandalone = () => {
      const standaloneQuery = window.matchMedia('(display-mode: standalone)').matches;
      const iosStandalone = (window.navigator as any).standalone === true;
      const androidApp = document.referrer.includes('android-app://');
      setIsStandalone(standaloneQuery || iosStandalone || androidApp);
    };

    checkStandalone();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener?.('change', checkStandalone);

    return () => {
      window.removeEventListener('resize', handleResize);
      mediaQuery.removeEventListener?.('change', checkStandalone);
    };
  }, []);

  // Determine active interface mode
  const isMobileScreen = windowWidth < 768;
  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const isMobileUA =
    typeof window !== 'undefined' &&
    /Android|webOS|iPhone|iPad|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const isAndroid =
    typeof window !== 'undefined' &&
    /Android/i.test(navigator.userAgent);

  // Defaults to 'mobile' (Android mobile interface)
  const detectedMode: InterfaceMode = 'mobile';

  const currentMode: InterfaceMode =
    preferredMode === 'auto' ? detectedMode : preferredMode;

  const setMode = (mode: 'auto' | 'mobile' | 'pc') => {
    setPreferredMode(mode);
    try {
      localStorage.setItem('vigilytics_interface_mode', mode);
    } catch {
      // ignore
    }
  };

  const toggleMode = () => {
    const next = currentMode === 'mobile' ? 'pc' : 'mobile';
    setMode(next);
  };

  return {
    currentMode,
    preferredMode,
    detectedMode,
    isMobileScreen,
    isMobileUA,
    isTouchDevice,
    isStandalone,
    isAndroid,
    setMode,
    toggleMode,
  };
}
