import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata, Viewport } from 'next';
import { Fredoka, Noto_Sans_SC, Noto_Serif_SC } from 'next/font/google';
import './globals.css';

const fredoka = Fredoka({
  variable: '--font-fredoka',
  subsets: ['latin'],
  display: 'swap',
});

const notoSansSC = Noto_Sans_SC({
  variable: '--font-noto-sc',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '700'],
});

const notoSerifSC = Noto_Serif_SC({
  variable: '--font-noto-serif-sc',
  subsets: ['latin'],
  display: 'swap',
  weight: ['600', '700'],
});

export const metadata: Metadata = {
  title: '汉字探险 · Hanzi Quest',
  description: "Make your school's weekly Chinese characters playable.",
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: '汉字探险',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#2a9a93',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html
        lang="en"
        className={`${fredoka.variable} ${notoSansSC.variable} ${notoSerifSC.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
