import { getRequestConfig } from 'next-intl/server';
import { loadMessages } from './messages';
import { resolveRequestLocale } from './request-locale';

export default getRequestConfig(async (params) => {
  const locale = await resolveRequestLocale({
    override: params.locale,
    // Accessed lazily: next-intl's `requestLocale` getter reads headers().
    readRequestLocale: () => params.requestLocale,
  });

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
