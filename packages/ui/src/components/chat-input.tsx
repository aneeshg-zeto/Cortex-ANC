'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

import { cn } from '../lib/utils';

export type ChatInputProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
};

export function ChatInput({
  value,
  onValueChange,
  onSubmit,
  placeholder = 'Ask Cortex…',
  disabled = false,
  isLoading = false,
  className,
}: ChatInputProps) {
  const [internalValue, setInternalValue] = useState(value ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentValue = value ?? internalValue;

  const setValue = (next: string) => {
    setInternalValue(next);
    onValueChange?.(next);
  };

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [currentValue]);

  const handleSubmit = () => {
    if (!currentValue.trim() || disabled || isLoading) return;
    onSubmit?.();
  };

  return (
    <div
      className={cn(
        'glass flex items-end gap-2 p-2 transition-all duration-200 focus-within:border-purple-500/40 focus-within:shadow-[0_0_24px_rgba(59,130,246,0.15)]',
        disabled && 'opacity-60',
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        value={currentValue}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        rows={1}
        className="input-dark min-h-[44px] max-h-40 flex-1 resize-none border-none bg-transparent px-2 py-2 text-sm"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || isLoading || !currentValue.trim()}
        className="btn-gradient inline-flex size-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
      >
        <Send className="size-4" />
      </button>
    </div>
  );
}
