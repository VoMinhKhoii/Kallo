'use client';

import { Braces, Layers } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Client wrapper that splits the request-detail trace into a digested
 * "Summary" view and the full "Raw trace". Sections are rendered on the
 * server and passed in as props so all data fetching + Zod parsing stays
 * server-side; this component only owns the tab UI.
 *
 * The tab bar is sticky (below the admin nav) so it doubles as a persistent
 * stage switcher — no scrolling back up to change views.
 */
export function RequestDetailTabs({
  summary,
  rawTrace,
}: {
  summary: ReactNode;
  rawTrace: ReactNode;
}) {
  return (
    <Tabs className="gap-4" defaultValue="summary">
      <div className="sticky top-12 z-20 -mx-3 border-nham-border/60 border-b bg-nham-surface/90 px-3 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <TabsList variant="line">
          <TabsTrigger value="summary">
            <Layers aria-hidden />
            Summary
          </TabsTrigger>
          <TabsTrigger value="raw">
            <Braces aria-hidden />
            Raw trace
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="summary">{summary}</TabsContent>
      <TabsContent value="raw">{rawTrace}</TabsContent>
    </Tabs>
  );
}
