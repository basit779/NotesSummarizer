import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Protected } from './components/Protected';
import { GridBackground } from './components/fx/GridBackground';
import { PageTransition } from './components/fx/PageTransition';
import { useAuth } from './lib/auth';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/Upload';
import Results from './pages/Results';
import History from './pages/History';
import Billing from './pages/Billing';

export default function App() {
  const init = useAuth((s) => s.init);
  const location = useLocation();
  useEffect(() => { init(); }, [init]);

  return (
    <div className="relative min-h-screen flex flex-col text-white">
      <GridBackground />
      <Navbar />
      <main className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
            <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
            <Route path="/signup" element={<PageTransition><Signup /></PageTransition>} />
            <Route path="/dashboard" element={<Protected><PageTransition><Dashboard /></PageTransition></Protected>} />
            <Route path="/upload" element={<Protected><PageTransition><UploadPage /></PageTransition></Protected>} />
            <Route path="/results/:id" element={<Protected><PageTransition><Results /></PageTransition></Protected>} />
            <Route path="/history" element={<Protected><PageTransition><History /></PageTransition></Protected>} />
            <Route path="/billing" element={<Protected><PageTransition><Billing /></PageTransition></Protected>} />
          </Routes>
        </AnimatePresence>
      </main>
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
  );
}
