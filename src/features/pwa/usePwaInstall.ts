'use client';

// Hook Pendaftaran Service Worker & Pengelolaan Prompt Instalasi PWA 1-Tap

import { useCallback, useEffect, useState } from 'react';
import { withBasePath } from '@/core/url/basePath';
import { isIosDevice, isStandalonePwa } from '@/features/lockdown/screenCheck';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaInstallState {
  isStandalone: boolean;
  isIos: boolean;
  canPromptInstall: boolean;
  justInstalled: boolean;
  triggerInstall: () => Promise<void>;
}

export function usePwaInstall(): PwaInstallState {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    setIsStandalone(isStandalonePwa());
    setIsIos(isIosDevice());

    // Daftarkan Service Worker agar syarat installable PWA terpenuhi
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register(withBasePath('/sw.js'), { scope: withBasePath('/') })
        .catch(() => {
          // Abaikan bila browser dalam mode privat tanpa dukungan Service Worker
        });
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setJustInstalled(true);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setJustInstalled(true);
      }
      setDeferredPrompt(null);
    } catch {
      // Abaikan jika user membatalkan dialog instalasi
    }
  }, [deferredPrompt]);

  return {
    isStandalone,
    isIos,
    canPromptInstall: Boolean(deferredPrompt) && !isStandalone,
    justInstalled,
    triggerInstall,
  };
}
