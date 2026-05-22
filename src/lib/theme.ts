/**
 * Theme preference (Light / Dark / System).
 *
 * Dark mode ships as a `@media (prefers-color-scheme: dark)` token flip
 * (see styles.css). To let a user override the OS we layer a
 * `data-theme` attribute on <html>:
 *
 *   - data-theme="dark"   → force the dark token set
 *   - data-theme="light"  → force the light token set (even on a dark OS)
 *   - data-theme="system" / absent → defer to prefers-color-scheme
 *
 * The chosen value is persisted in localStorage under THEME_KEY. An inline
 * no-flash script in __root.tsx reads it before first paint so there's no
 * light→dark flicker; this module is the typed client API the Settings
 * picker calls at runtime.
 */
export type ThemePref = "light" | "dark" | "system";

export const THEME_KEY = "lk-theme";

export function getThemePref(): ThemePref {
  if (typeof localStorage === "undefined") return "system";
  const v = localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

export function applyThemePref(pref: ThemePref): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (pref === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", pref);
  }
}

export function setThemePref(pref: ThemePref): void {
  if (typeof localStorage !== "undefined") {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  }
  applyThemePref(pref);
}

/**
 * Inline-script source. Runs before hydration so the correct token set is
 * present on first paint. Kept as a string (not a module import) because it
 * must execute synchronously in <head> with no bundler round-trip.
 */
export const THEME_NOFLASH_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;
