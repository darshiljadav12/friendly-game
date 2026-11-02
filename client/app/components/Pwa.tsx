"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Registers the service worker and offers an "Install app" button where the browser supports it
export default function Pwa() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    // Skip in development so hot reload isn't served from cache
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt) return null;

  return (
    <button
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice.catch(() => null);
        setPrompt(null);
      }}
      className="fixed bottom-4 right-4 z-40 btn btn-primary px-4 py-2 text-sm"
    >
      📲 Install app
    </button>
  );
}
