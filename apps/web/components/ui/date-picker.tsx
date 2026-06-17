'use client';

import { format, parse } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type DatePickerProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
};

function parseIsoDate(value?: string) {
  if (!value) return undefined;
  try {
    return parse(value, 'yyyy-MM-dd', new Date());
  } catch {
    return undefined;
  }
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  disabled,
  id,
}: DatePickerProps) {
  const date = parseIsoDate(value);

  return (
    <Popover>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        className={cn(
          'inline-flex h-9 w-full items-center justify-start gap-2 rounded-lg border border-border bg-background px-3 text-sm font-normal whitespace-nowrap transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50',
          !value && 'text-muted-foreground',
          className,
        )}
      >
        <CalendarIcon className="size-4 shrink-0" />
        {date ? format(date, 'PPP') : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(next) => onChange(next ? format(next, 'yyyy-MM-dd') : '')}
          defaultMonth={date}
        />
      </PopoverContent>
    </Popover>
  );
}
