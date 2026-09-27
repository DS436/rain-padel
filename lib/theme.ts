/**
 * Light or dark.
 *
 * With nothing chosen the app follows the phone. The mock's "Switch to dark /
 * Switch to light" pill overrides that, and the choice sticks — in a cookie,
 * not localStorage, because the app keeps nothing in browser storage (Supabase
 * is the only store; a cookie is a preference the browser sends, not data).
 *
 * The resolved theme lives on `<html data-theme>`, and it has to be there
 * before the first paint or a dark-mode phone flashes white on every load. So
 * the resolving is done twice: once by `THEME_SCRIPT`, inlined in the layout's
 * head, and once here for the toggle. They read the same cookie the same way.
 */

export type Theme = 'light' | 'dark';

export const THEME_COOKIE = 'rp-theme';

/**
 * The address bar colour for each theme — the page ground. The head script
 * owns the one `theme-color` meta tag; the layout declares none, because Next
 * re-inserts its own after hydration and they would fight the choice.
 */
export const THEME_COLOR: Record<Theme, string> = { light: '#F4F5F8', dark: '#0E1018' };

/** A year; the choice is a preference, not a session. */
const MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Runs in the head before anything renders. Kept tiny and dependency-free:
 * it is a string, so nothing it references can be imported.
 */
export const THEME_SCRIPT = `(function(){try{
var d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');
function saved(){var c=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);return c?c[1]:null}
function apply(){var t=saved()||(m.matches?'dark':'light');d.dataset.theme=t;
var e=document.querySelector('meta[name="theme-color"]');if(!e){e=document.createElement('meta');e.name='theme-color';document.head.appendChild(e)}
e.setAttribute('content',t==='dark'?'${THEME_COLOR.dark}':'${THEME_COLOR.light}')}
apply();m.addEventListener('change',function(){if(!saved())apply();document.dispatchEvent(new Event('rp-theme'))});
}catch(e){}})();`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Pick a theme explicitly, from the toggle. */
export function setTheme(theme: Theme): void {
  document.cookie = `${THEME_COOKIE}=${theme}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax`;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  document.dispatchEvent(new Event('rp-theme'));
}

/** For useSyncExternalStore: fires when the toggle or the system changes it. */
export function subscribeTheme(onChange: () => void): () => void {
  document.addEventListener('rp-theme', onChange);
  return () => document.removeEventListener('rp-theme', onChange);
}
