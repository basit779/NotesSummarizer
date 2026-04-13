import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { Check, Sparkles } from 'lucide-react';

export default function Billing() {
  const { user, refresh } = useAuth();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [sub, setSub] = useState<any>(null);

  useEffect(() => {
    api.get('/stripe/subscription-status').then((r) => setSub(r.data.subscription));
  }, []);

  useEffect(() => {
    if (params.get('success')) {
      toast.success('Welcome to Pro! 🎉');
      setTimeout(() => refresh(), 1500);
    } else if (params.get('canceled')) {
      toast.info('Checkout canceled.');
    }
  }, [params, refresh]);

  async function upgrade() {
    setLoading(true);
    try {
      const { data } = await api.post('/stripe/checkout');
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Could not start checkout');
      setLoading(false);
    }
  }

  const isPro = user?.plan === 'PRO';

  return (
    <div className="container py-10 max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Billing</h1>

      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan:
            <span className={isPro ? 'gradient-text' : ''}>
              {isPro ? <><Sparkles className="h-4 w-4 inline" /> Pro</> : 'Free'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isPro ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">You have full access to unlimited uploads and advanced features.</p>
              {sub?.currentPeriodEnd && (
                <p className="text-sm">Renews on {new Date(sub.currentPeriodEnd).toLocaleDateString()}.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Upgrade to unlock unlimited uploads, faster processing, advanced exam questions, and flashcard export.</p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Unlimited uploads</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Faster AI processing</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> 10-12 exam questions per doc</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> CSV flashcard export</li>
              </ul>
              <Button variant="gradient" size="lg" onClick={upgrade} disabled={loading}>
                {loading ? 'Starting checkout…' : 'Upgrade to Pro — $9/mo'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
