'use client';

import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function MultiSelectFilter<T extends string>({
  label,
  options,
  labels,
  selected,
  onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected: T[] | undefined;
  onChange: (next: T[] | undefined) => void;
}) {
  const current = selected ?? [];
  const toggle = (value: T, checked: boolean) => {
    const next = checked ? [...current, value] : current.filter((v) => v !== value);
    onChange(next.length ? next : undefined);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          {label}
          {current.length > 0 && (
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              {current.length}
            </Badge>
          )}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={current.includes(option)}
            onCheckedChange={(checked) => toggle(option, checked === true)}
            onSelect={(e) => e.preventDefault()}
          >
            {labels[option]}
          </DropdownMenuCheckboxItem>
        ))}
        {current.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(undefined)} className="justify-center">
              Limpiar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
