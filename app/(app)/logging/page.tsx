import { FeedArea } from '@/components/logging/feed/feed-area';
import { TimelineSidebar } from '@/components/logging/sidebar/timeline-sidebar';

export default async function LoggingPage() {
  return (
    <>
      <TimelineSidebar />
      <FeedArea />
    </>
  );
}
