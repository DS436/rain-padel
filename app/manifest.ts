import type { MetadataRoute } from 'next';

/** Add to home screen and it launches without browser chrome. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rain Padel',
    short_name: 'Padel',
    description: 'Run an Americano or Mexicano padel session from your phone.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F4F5F8',
    theme_color: '#F4F5F8',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
