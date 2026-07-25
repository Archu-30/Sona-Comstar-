import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/DropdownMenu';

const API_BASE = '';

export function UploadButton() {
  const inputRef = useRef(null);
  const [kind, setKind] = useState(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  function chooseFile(k) {
    setKind(k);
    inputRef.current?.click();
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !kind) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Upload failed');
      toast.success(`Uploaded ${kind === 'ageing' ? 'Ageing' : 'GIT'} file: ${body.file}`);
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setBusy(false);
      setKind(null);
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xlsb,.xls" hidden onChange={onFile} />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
              Upload
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => chooseFile('ageing')}>Ageing Report (.xlsx)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => chooseFile('git')}>GIT File (.xlsx/.xlsb)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
