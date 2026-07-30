import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { ChromeGate } from '@/components/ChromeGate';
import { AuthInit } from '@/components/AuthInit';
import { KeepAlive } from '@/components/KeepAlive';
import { RouteProgress } from '@/components/RouteProgress';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const OG_TITLE = 'StudySnap — AI study packs from any PDF';
const OG_DESCRIPTION = 'Upload a PDF, get structured notes, flashcards, quizzes, and a chat tutor. Free for students.';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: OG_TITLE,
  description: OG_DESCRIPTION,
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: APP_URL,
    siteName: 'StudySnap',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <AuthInit />
        <KeepAlive />
        <RouteProgress />
        <div className="relative min-h-screen flex flex-col text-black">
          <ChromeGate>
            <main className="flex-1">{children}</main>
          </ChromeGate>
          <Toaster
            theme="light"
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid rgba(0,0,0,0.1)',
                color: 'rgba(0,0,0,0.9)',
                backdropFilter: 'blur(12px)',
              },
            }}
          />
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
