import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '汉字探险 · Hanzi Quest',
    short_name: '汉字探险',
    description: 'A weekly Chinese-character adventure for kids.',
    start_url: '/parent',
    display: 'standalone',
    background_color: '#fdf8ec',
    theme_color: '#2a9a93',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
