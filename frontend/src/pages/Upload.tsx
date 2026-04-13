import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadCloud, Loader2, FileText } from 'lucide-react';

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'processing'>('idle');

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop: (accepted) => {
      if (accepted[0]) setFile(accepted[0]);
    },
  });

  async function handleStart() {
    if (!file) return;
    try {
      setStage('uploading');
      const form = new FormData();
      form.append('file', file);
      const { data: uploaded } = await api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setStage('processing');
      toast.info('Running AI analysis — this takes ~15-30 seconds.');
      const { data: processed } = await api.post(`/process/${uploaded.file.id}`);
      toast.success('Your study pack is ready!');
      navigate(`/results/${processed.result.id}`);
    } catch (err: any) {
      const data = err?.response?.data?.error;
      if (data?.code === 'FREE_LIMIT_REACHED') {
        toast.error(data.message, {
          action: { label: 'Upgrade', onClick: () => navigate('/billing') },
        });
      } else {
        toast.error(data?.message ?? 'Something went wrong');
      }
      setStage('idle');
    }
  }

  return (
    <div className="container py-12 max-w-2xl">
      <h1 className="text-3xl font-bold">Upload a PDF</h1>
      <p className="text-muted-foreground mt-2">
        Drop a lecture PDF, textbook chapter, or notes file. We'll extract the text and build your study pack.
      </p>

      <Card className="mt-8 card-glow">
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-all cursor-pointer ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="h-12 w-12 text-primary" />
            <p className="mt-4 font-medium">
              {isDragActive ? 'Drop the PDF here…' : 'Drag & drop a PDF, or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Max 15 MB</p>
          </div>

          {file && (
            <div className="mt-6 flex items-center justify-between rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium text-sm">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)} disabled={stage !== 'idle'}>
                Remove
              </Button>
            </div>
          )}

          <Button
            variant="gradient"
            size="lg"
            className="mt-6 w-full"
            disabled={!file || stage !== 'idle'}
            onClick={handleStart}
          >
            {stage === 'idle' && 'Generate study pack'}
            {stage === 'uploading' && <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>}
            {stage === 'processing' && <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing with Claude…</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
