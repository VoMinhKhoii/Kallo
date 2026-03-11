import { ChatArea } from '@/components/logging/chat-area';
import { TimelineSidebar } from '@/components/logging/timeline-sidebar';

export default async function LoggingPage() {
  return (
    <>
      <TimelineSidebar />
      <ChatArea />
    </>
  );
}
