import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Protected } from './components/Protected';
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
  useEffect(() => { init(); }, [init]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/upload" element={<Protected><UploadPage /></Protected>} />
          <Route path="/results/:id" element={<Protected><Results /></Protected>} />
          <Route path="/history" element={<Protected><History /></Protected>} />
          <Route path="/billing" element={<Protected><Billing /></Protected>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
