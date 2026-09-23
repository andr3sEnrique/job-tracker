'use client';

import type { EmailCategory } from '@jat/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { APPLICATION_CATEGORIES, CATEGORY_LABELS } from '@/lib/labels';

export function CategorySelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: EmailCategory;
  onChange: (value: EmailCategory) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as EmailCategory)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {APPLICATION_CATEGORIES.map((c) => (
          <SelectItem key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
