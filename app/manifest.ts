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
    background_color: '#040D12',
    theme_color: '#040D12',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
