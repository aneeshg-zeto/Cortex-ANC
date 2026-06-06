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
  variant?: 'dark' | 'light';
};

export function ChatInput({
  value,
  onValueChange,
  onSubmit,
  placeholder = 'Ask Cortex…',
  disabled = false,
  isLoading = false,
  className,
  variant = 'dark',
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
        variant === 'light'
          ? 'flex items-end gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-500/20'
          : 'flex items-end gap-2 border border-[#2a2a2a] bg-[#1a1a1a] p-2 transition-all duration-200 focus-within:border-[#14b8a6]/50',
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
        className={cn(
          'min-h-[44px] max-h-40 flex-1 resize-none border-none bg-transparent px-2 py-2 text-sm outline-none',
          variant === 'light'
            ? 'text-[#111111] placeholder:text-gray-400'
            : 'text-zinc-100 placeholder:text-zinc-500',
        )}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || isLoading || !currentValue.trim()}
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center disabled:opacity-50',
          variant === 'light'
            ? 'rounded-xl bg-teal-600 text-white hover:bg-teal-700'
            : 'bg-[#14b8a6] text-black hover:bg-[#0d9488]',
        )}
      >
        <Send className="size-4" />
      </button>
    </div>
  );
}
