import { robotsTxt } from '@/lib/seo/robots';

/** `/robots.txt`; the rules and why it is not a Next `robots.ts` are in `lib/seo/robots.ts`. */
export function GET(): Response {
  return new Response(robotsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
