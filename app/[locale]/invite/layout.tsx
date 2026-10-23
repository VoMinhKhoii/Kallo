import { AppThemeProvider } from '@/components/providers/theme/app-theme-provider';

/** One of the app's own pages, so it follows Settings → Appearance. */
export default function ThemedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppThemeProvider>{children}</AppThemeProvider>;
}
