import { defineRouting } from 'next-intl/routing';
import { routingConfig } from './config';

/**
 * next-intl's routing object, on its own so `proxy.ts` can import it without
 * `navigation.ts`. `createNavigation` pulls in the server request config
 * (`i18n/request.ts` → `next/root-params`), and `next/root-params` does not
 * exist in the proxy bundle — importing navigation there fails the build.
 */
export const routing = defineRouting(routingConfig);
