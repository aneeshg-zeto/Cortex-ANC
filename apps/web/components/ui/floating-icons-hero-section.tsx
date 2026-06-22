'use client';

import * as React from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FloatingIconItem {
  id: number;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  className: string;
}

export interface FloatingIconsHeroProps {
  heading: React.ReactNode;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  icons: FloatingIconItem[];
}

function FloatingIcon({
  mouseX,
  mouseY,
  iconData,
  index,
}: {
  mouseX: React.MutableRefObject<number>;
  mouseY: React.MutableRefObject<number>;
  iconData: FloatingIconItem;
  index: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 280, damping: 22 });
  const springY = useSpring(y, { stiffness: 280, damping: 22 });
  const driftDuration = 5 + (index % 5);

  React.useEffect(() => {
    const handleMouseMove = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const distance = Math.hypot(mouseX.current - cx, mouseY.current - cy);
      if (distance < 140) {
        const angle = Math.atan2(mouseY.current - cy, mouseX.current - cx);
        const force = (1 - distance / 140) * 48;
        x.set(-Math.cos(angle) * force);
        y.set(-Math.sin(angle) * force);
      } else {
        x.set(0);
        y.set(0);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [x, y, mouseX, mouseY]);

  return (
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={cn('absolute z-0', iconData.className)}
    >
      <motion.div
        className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card/80 p-2.5 shadow-lg backdrop-blur-md md:size-[4.5rem] md:p-3"
        animate={{ y: [0, -7, 0, 7, 0], x: [0, 5, 0, -5, 0], rotate: [0, 4, 0, -4, 0] }}
        transition={{
          duration: driftDuration,
          repeat: Infinity,
          repeatType: 'mirror',
          ease: 'easeInOut',
        }}
      >
        <iconData.icon className="size-7 text-foreground md:size-8" />
      </motion.div>
    </motion.div>
  );
}

export function FloatingIconsHero({
  className,
  heading,
  subtitle,
  ctaText,
  ctaHref,
  secondaryCtaText,
  secondaryCtaHref,
  icons,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & FloatingIconsHeroProps) {
  const mouseX = React.useRef(0);
  const mouseY = React.useRef(0);

  return (
    <section
      onMouseMove={(e) => {
        mouseX.current = e.clientX;
        mouseY.current = e.clientY;
      }}
      className={cn(
        'relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden bg-background',
        className,
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(20,184,166,0.12),transparent_55%)]" />

      <div className="absolute inset-0 hidden md:block">
        {icons.map((iconData, index) => (
          <FloatingIcon
            key={iconData.id}
            mouseX={mouseX}
            mouseY={mouseY}
            iconData={iconData}
            index={index}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center md:px-12">
        <h1 className="font-display text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.95] tracking-tight text-foreground">
          {heading}
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
          {subtitle}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button
            nativeButton={false}
            render={<a href={ctaHref}>{ctaText}</a>}
            className="h-12 rounded-none bg-primary px-8 text-sm font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
          />
          {secondaryCtaText && secondaryCtaHref && (
            <a
              href={secondaryCtaHref}
              className="border border-border px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {secondaryCtaText}
            </a>
          )}
        </div>
        <p className="mt-16 font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
          Scroll ↓
        </p>
      </div>
    </section>
  );
}
