import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Flashcard } from '@/components/Flashcard';
import { useAuth } from '@/lib/auth';
import { Copy, Download, Lock } from 'lucide-react';

interface ResultData {
  id: string;
  summary: string;
  keyPoints: string[];
  definitions: { term: string; definition: string }[];
  examQuestions: { question: string; answer: string; difficulty: string }[];
  flashcards: { front: string; back: string }[];
  file: { filename: string; pageCount: number | null };
  createdAt: string;
}

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [result, setResult] = useState<ResultData | null>(null);

  useEffect(() => {
    api.get(`/results/${id}`).then((r) => setResult(r.data.result));
  }, [id]);

  if (!result) return <div className="container py-20 text-center text-muted-foreground">Loading study pack…</div>;

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  function exportFlashcards() {
    if (user?.plan !== 'PRO') {
      toast.error('Flashcard export is a Pro feature.');
      return;
    }
    const csv = ['Front,Back', ...result!.flashcards.map((f) => `"${f.front.replace(/"/g, '""')}","${f.back.replace(/"/g, '""')}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result!.file.filename}-flashcards.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container py-10 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{result.file.filename}</h1>
          <p className="text-sm text-muted-foreground">
            {result.file.pageCount ?? '?'} pages · Generated {new Date(result.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="key">Key Points</TabsTrigger>
          <TabsTrigger value="defs">Definitions</TabsTrigger>
          <TabsTrigger value="flash">Flashcards</TabsTrigger>
          <TabsTrigger value="exam">Exam Questions</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-end mb-2">
                <Button variant="ghost" size="sm" onClick={() => copy(result.summary)}>
                  <Copy className="h-4 w-4" /> Copy
                </Button>
              </div>
              <p className="leading-relaxed whitespace-pre-wrap">{result.summary}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="key">
          <Card>
            <CardContent className="p-6">
              <ul className="space-y-3">
                {result.keyPoints.map((p, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-hero text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defs">
          <div className="grid md:grid-cols-2 gap-4">
            {result.definitions.map((d, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="font-semibold gradient-text">{d.term}</div>
                  <div className="mt-1 text-sm text-muted-foreground leading-relaxed">{d.definition}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="flash">
          <div className="flex justify-end mb-4">
            <Button variant={user?.plan === 'PRO' ? 'gradient' : 'outline'} size="sm" onClick={exportFlashcards}>
              {user?.plan === 'PRO' ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              Export CSV {user?.plan !== 'PRO' && '(Pro)'}
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {result.flashcards.map((f, i) => (
              <Flashcard key={i} front={f.front} back={f.back} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="exam">
          <div className="space-y-4">
            {result.examQuestions.map((q, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-medium">{i + 1}. {q.question}</div>
                      <details className="mt-3 text-sm text-muted-foreground">
                        <summary className="cursor-pointer text-primary hover:underline">Show answer</summary>
                        <p className="mt-2 leading-relaxed">{q.answer}</p>
                      </details>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      q.difficulty === 'easy' ? 'bg-green-500/10 text-green-500' :
                      q.difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-red-500/10 text-red-500'
                    }`}>{q.difficulty}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
