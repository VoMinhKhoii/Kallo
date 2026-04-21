import { Shell } from '@/components/settings/shell';

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <Shell>{children}</Shell>;
}
