import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { GridBackground } from '@/components/fx/GridBackground';
import { AuthInit } from '@/components/AuthInit';
import { KeepAlive } from '@/components/KeepAlive';
import { RouteProgress } from '@/components/RouteProgress';

export const metadata: Metadata = {
  title: 'StudySnap AI — Study at the speed of thought',
  description: 'The AI study operating system. Upload a PDF, get summaries, flashcards, and exam-ready notes in seconds.',
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
