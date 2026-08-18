import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Rain Padel',
  description: 'Run an Americano or Mexicano padel session from your phone.',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Rain Padel' },
};

export const viewport: Viewport = {
  themeColor: '#0b0f0c',
  // the round screen has fixed footers; cover the notch and lock zoom-on-tap
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
