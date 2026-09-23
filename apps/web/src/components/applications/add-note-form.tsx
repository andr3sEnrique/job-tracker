'use client';

import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAddNote } from '@/lib/api/queries';
import { errorMessage } from '@/lib/errors';

export function AddNoteForm({ applicationId }: { applicationId: string }) {
  const [text, setText] = useState('');
  const addNote = useAddNote(applicationId);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    addNote.mutate(
      { text: trimmed },
      {
        onSuccess: () => {
          setText('');
          toast.success('Nota añadida');
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Añade una nota al historial…"
        aria-label="Nueva nota"
        rows={2}
        maxLength={2000}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!text.trim() || addNote.isPending}>
          {addNote.isPending && <Loader2 className="animate-spin" />}
          Añadir nota
        </Button>
      </div>
    </form>
  );
}
