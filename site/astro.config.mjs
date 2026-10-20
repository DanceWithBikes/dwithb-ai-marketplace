import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// site/base come from env so a custom domain later is a config-only change.
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321/',
  base: process.env.BASE_PATH || '/',
  integrations: [preact()],
});
