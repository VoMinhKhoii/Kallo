export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The settings master-detail was flattened into one scrollable page; the
  // layout now just provides the scroll container the route group expects.
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
      {children}
    </div>
  );
}
