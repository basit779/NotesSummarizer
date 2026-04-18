import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { GridBackground } from '@/components/fx/GridBackground';
import { AuthInit } from '@/components/AuthInit';
import { KeepAlive } from '@/components/KeepAlive';
import { RouteProgress } from '@/components/RouteProgress';

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
  themeColor: '#09090b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <AuthInit />
        <KeepAlive />
        <RouteProgress />
        <div className="relative min-h-screen flex flex-col text-white">
          <GridBackground />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'rgba(18,18,24,0.9)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(12px)',
              },
            }}
          />
        </div>
      </body>
    </html>
  );
}
