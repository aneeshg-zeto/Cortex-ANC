'use client';

import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '../lib/utils';

export type MarkdownProps = {
  children: string;
  className?: string;
};

function MarkdownComponent({ children, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        'prose prose-sm prose-invert max-w-none',
        '[&_a]:text-cyan-400 [&_code]:font-mono [&_code]:text-cyan-300',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownComponent);
Markdown.displayName = 'Markdown';
