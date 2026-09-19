import type { Metadata, Viewport } from 'next';
import { Archivo, Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
/* The display face — headings and every numeral read from across the court.
   Variable width so `.disp` can hold it at wdth 110, which is what stops the
   big score numerals looking thin next to Geist's text weights. */
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  axes: ['wdth'],
});

export const metadata: Metadata = {
  title: 'Rain Padel',
  description: 'Run an Americano or Mexicano padel session from your phone.',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Rain Padel' },
};

export const viewport: Viewport = {
  themeColor: '#040D12',
  // the round screen has fixed footers; cover the notch and lock zoom-on-tap
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
