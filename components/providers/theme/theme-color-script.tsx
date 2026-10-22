import { THEME_COLOR, THEME_STORAGE_KEY } from '@/lib/core/theme/themes';

/**
 * Sets `<meta name="theme-color">` from the stored theme before first paint,
 * the way next-themes' own script sets the page class. Without it a reload in
 * Dark or Aurora paints the browser bar and a standalone PWA's status-bar zone
 * in the light layout's cream until React hydrates (ThemeColorSync then keeps
 * it in step with later changes).
 */
const SCRIPT = `(function(){try{var c=${JSON.stringify(THEME_COLOR)};var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||'system';if(t==='system')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var m=document.querySelector('meta[name="theme-color"]');if(m&&c[t])m.setAttribute('content',c[t]);}catch(e){}})()`;

export function ThemeColorScript() {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: a constant built from our own theme table, never user input — it must run before paint, which only an inline script can.
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
      suppressHydrationWarning
    />
  );
}
