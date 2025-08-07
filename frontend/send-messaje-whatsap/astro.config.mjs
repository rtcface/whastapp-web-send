// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/postcss';

// https://astro.build/config
export default defineConfig({
  integrations: [],
  postcss: {
    plugins: [
      tailwindcss()
    ]
  }
});
