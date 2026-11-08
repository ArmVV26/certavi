import { defineConfig } from '@vite-pwa/assets-generator/config';

// PNG icons generated from public/icon.svg with `npm run icons`; the PNGs are committed, so
// the build does not depend on sharp. The SVG already has a solid full-bleed background (iOS
// ignores transparency) and keeps its drawing inside the maskable safe zone, so every size is
// the plain image with no extra padding.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    maskable: { sizes: [512], padding: 0 },
    apple: { sizes: [180], padding: 0 },
  },
  images: ['public/icon.svg'],
});
