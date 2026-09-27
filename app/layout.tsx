import type { Metadata, Viewport } from 'next';
import { Schibsted_Grotesk } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';

/* One family for everything — headings, names and every numeral read from
   across the court. The redesign uses three weights of it and nothing else. */
const schibsted = Schibsted_Grotesk({
  variable: '--font-schibsted',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Rain Padel',
  description: 'Run an Americano or Mexicano padel session from your phone.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Rain Padel' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F5F8' },
    { media: '(prefers-color-scheme: dark)', color: '#0E1018' },
  ],
  // the round screen has fixed footers; cover the notch and lock zoom-on-tap
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${schibsted.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
