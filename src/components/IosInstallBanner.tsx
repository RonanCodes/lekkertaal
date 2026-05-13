/**
 * iOS-friendly install prompt.
 *
 * iOS Safari doesn't fire beforeinstallprompt so the only path to install
 * is "Share → Add to Home Screen". We show a small dismissable banner
 * that explains those steps, and only on iOS Safari, only when the app
 * isn't already running standalone.
 *
 * The dismissal is sticky for 7 days via localStorage.
 */
import { useEffect, useState } from "react";

const DISMISS_KEY = "lekkertaal:ios-install-dismissed-until";

export function IosInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isIosSafari()) return;
    if (isStandalone()) return;

    const dismissUntil = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (Date.now() < dismissUntil) return;

    setVisible(true);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-orange-200 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="flex items-start gap-3">
        <div className="text-3xl" aria-hidden>
          📲
        </div>
        <div className="flex-1 text-sm">
          <p className="font-semibold text-neutral-900">
            Install Lekkertaal on your iPhone
          </p>
          <p className="mt-1 text-neutral-600">
            Tap <span aria-label="share">⬆</span> below, then{" "}
            <strong>Add to Home Screen</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mt-1 -mr-1 rounded-full p-1 text-neutral-400 hover:bg-neutral-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return iOS && webkit;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // navigator.standalone is iOS-specific.
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}
