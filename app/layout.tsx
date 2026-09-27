import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Schibsted_Grotesk } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { THEME_SCRIPT } from '@/lib/theme';

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
  // No themeColor: the head script writes the one tag, for the chosen theme.
  // the round screen has fixed footers; cover the notch and lock zoom-on-tap
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The head script sets data-theme before React hydrates, so the server's
    // <html> legitimately differs from the client's by that one attribute.
    <html lang="en" className={`${schibsted.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">
        {/* beforeInteractive puts this in the head ahead of every other
            script, so the theme is set before the first paint. */}
        <Script id="rp-theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
