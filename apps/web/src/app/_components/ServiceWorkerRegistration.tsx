"use client";

import { useEffect } from "react";

/**
 * Unregisters any existing service workers from previous versions.
 * We removed the service worker as it provided no real value for a marketplace
 * app with dynamic content and a native mobile app already available.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Unregister any existing service workers (cleanup from previous version)
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
          console.info("Service Worker unregistered:", registration.scope);
        });
      });
    }
  }, []);

  return null;
}
