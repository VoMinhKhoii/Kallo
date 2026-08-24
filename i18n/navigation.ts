import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import { routingConfig } from './config';

export const routing = defineRouting(routingConfig);

export const {
  Link,
  redirect,
  permanentRedirect,
  usePathname,
  useRouter,
  getPathname,
} = createNavigation(routing);
