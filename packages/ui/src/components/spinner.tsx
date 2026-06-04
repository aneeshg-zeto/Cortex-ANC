'use client';

import { LoaderCircle } from 'lucide-react';
import React from 'react';

import { cn } from '../lib/utils';

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  isLarge?: boolean;
}

export const Spinner = React.memo(({ className, isLarge = false }: SpinnerProps) => (
  <LoaderCircle
    className={cn(
      'animate-spin text-cyan-400 animate-pulse-glow',
      { 'size-6': !isLarge, 'size-12': isLarge },
      className,
    )}
    strokeWidth={2}
  />
));

Spinner.displayName = 'Spinner';
