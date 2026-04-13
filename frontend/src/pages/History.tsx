import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

interface Item {
  id: string;
  createdAt: string;
  summary: string;
  file: { filename: string; pageCount: number | null; sizeBytes: number };
}

export default function History() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    api.get('/history').then((r) => setItems(r.data.items));
  }, []);

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">History</h1>
      <Card>
        <CardHeader><CardTitle>All your study packs</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here yet — upload a PDF to get started.</p>
          ) : (
            <ul className="divide-y">
              {items.map((r) => (
                <li key={r.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.file.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString()} · {r.file.pageCount ?? '?'} pages
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-2 mt-1">{r.summary}</div>
                    </div>
                  </div>
                  <Link to={`/results/${r.id}`}><Button variant="outline" size="sm">Open</Button></Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
