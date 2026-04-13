import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UsageBar } from '@/components/UsageBar';
import { useAuth } from '@/lib/auth';
import { FileText, Upload } from 'lucide-react';

interface DashboardData {
  usage: { uploads: number; processed: number; limit: number | null; plan: string };
  recent: Array<{ id: string; createdAt: string; file: { filename: string; pageCount: number | null } }>;
  totals: { uploads: number; processed: number };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data));
  }, []);

  return (
    <div className="container py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Hey, {user?.name} 👋</h1>
        <p className="text-muted-foreground mt-1">Ready to turn notes into knowledge?</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <UsageBar used={data?.usage.uploads ?? 0} limit={data?.usage.limit ?? 3} />
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total uploads</div>
            <div className="mt-1 text-2xl font-bold">{data?.totals.uploads ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Documents processed</div>
            <div className="mt-1 text-2xl font-bold gradient-text">{data?.totals.processed ?? '—'}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Quick actions</CardTitle>
          <Link to="/upload"><Button variant="gradient"><Upload className="h-4 w-4" /> New upload</Button></Link>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Drop a PDF on the upload page — we'll extract the text, run it through Claude, and produce a full study pack in seconds.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent results</CardTitle></CardHeader>
        <CardContent>
          {data && data.recent.length === 0 && (
            <p className="text-sm text-muted-foreground">No results yet. Upload your first PDF to get started.</p>
          )}
          <ul className="divide-y">
            {data?.recent.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{r.file.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()} · {r.file.pageCount ?? '?'} pages
                    </div>
                  </div>
                </div>
                <Link to={`/results/${r.id}`}><Button variant="outline" size="sm">Open</Button></Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
