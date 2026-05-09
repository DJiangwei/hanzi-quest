import { getRequestConfig } from 'next-intl/server';

const DEFAULT_LOCALE = 'en';

export default getRequestConfig(async () => {
  return {
    locale: DEFAULT_LOCALE,
    messages: (await import(`./messages/${DEFAULT_LOCALE}.json`)).default,
  };
});
