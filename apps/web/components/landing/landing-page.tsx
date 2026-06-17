'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import { FloatingIconsHero } from '@/components/ui/floating-icons-hero-section';
import { CONNECTOR_TOTAL } from '@/lib/landing-tools';
import { useInView } from '@/hooks/use-in-view';

import { HERO_FLOATING_ICONS } from './connector-icons';

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { ref, visible } = useInView(0.12);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const revealed = !mounted || visible;

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${revealed ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="landing-page min-h-screen bg-black text-white">
      <FloatingIconsHero
        heading={
          <>
            One brain.
            <br />
            <span className="text-[#14b8a6]">Every answer.</span>
          </>
        }
        subtitle="Your company runs on a hundred tools and a thousand threads. Cortex unifies them — so when leadership needs the truth, it arrives on time, with sources."
        ctaText="Enter Cortex"
        ctaHref="/auth/login"
        secondaryCtaText="How it works"
        secondaryCtaHref="#story"
        icons={HERO_FLOATING_ICONS}
      />

      <section id="story" className="border-t border-white/10 bg-black">
        <div className="mx-auto max-w-[1400px] px-6 py-20 md:px-12 md:py-32">
          <Reveal className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-500">
              The problem
            </p>
            <h2 className="mt-6 font-display text-4xl leading-[1.05] text-white md:text-5xl lg:text-6xl">
              Everyone is working.
              <span className="block text-zinc-500">Nobody has the full picture.</span>
            </h2>
            <p className="mt-8 max-w-md text-base leading-relaxed text-zinc-400">
              Slack threads. Linear tickets. Client emails. Board decks. The signal is everywhere —
              except where the person governing the organization needs it. Cortex is the layer that
              combines it all and answers in plain language.
            </p>
          </Reveal>
        </div>
      </section>

      <section id="connected" className="border-t border-white/10 bg-zinc-950 py-24 md:py-32">
        <Reveal className="mx-auto max-w-[1400px] px-6 md:px-12">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-2xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#14b8a6]">
                Connected
              </p>
              <h2 className="mt-4 font-display text-4xl text-white md:text-6xl">
                {CONNECTOR_TOTAL}+ tools.
                <br />
                One memory.
              </h2>
              <p className="mt-6 text-lg text-zinc-400">
                Slack, GitHub, Gmail, Linear, CRM, finance, AI — ingested, indexed, and reasoned
                over. Not another dashboard. A brain that already read everything.
              </p>
            </div>
            <p className="font-display text-7xl text-white/10 md:text-9xl">
              {CONNECTOR_TOTAL}
              <span className="text-[#14b8a6]">+</span>
            </p>
          </div>
        </Reveal>
      </section>

      <section id="govern" className="border-t border-white/10 bg-black py-24 md:py-32">
        <div className="mx-auto max-w-[1400px] px-6 md:px-12">
          <Reveal>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-500">
              For leadership
            </p>
            <h2 className="mt-4 max-w-3xl font-display text-4xl text-white md:text-5xl">
              Governing means getting answers — not hunting for them.
            </h2>
          </Reveal>

          <div className="mt-16 grid gap-px bg-white/10 md:grid-cols-3">
            {[
              {
                n: '01',
                title: 'Ask anything',
                body: 'Status, blockers, revenue at risk, who owns what — across every tool, in one question.',
              },
              {
                n: '02',
                title: 'Cited, not guessed',
                body: 'Every response links back to Slack, Linear, email, or docs. Verify in one click.',
              },
              {
                n: '03',
                title: 'Act with approval',
                body: 'Draft client replies, route decisions, trigger workflows — human-in-the-loop by default.',
              },
            ].map(({ n, title, body }) => (
              <Reveal key={n} className="bg-black p-8 md:p-10">
                <span className="font-mono text-xs text-[#14b8a6]">{n}</span>
                <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-zinc-950 py-20">
        <Reveal className="mx-auto max-w-[1400px] px-6 text-center md:px-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-500">
            Self-improving
          </p>
          <p className="mx-auto mt-6 max-w-2xl font-display text-2xl text-white md:text-3xl">
            Ingest → policy → act → measure → learn.
            <span className="block text-zinc-500">Cortex tightens every night.</span>
          </p>
        </Reveal>
      </section>

      <section className="border-t border-white/10 bg-black py-24">
        <Reveal className="mx-auto max-w-xl px-6 text-center">
          <h2 className="font-display text-3xl text-white md:text-4xl">See it with your data.</h2>
          <p className="mt-4 text-sm text-zinc-500">
            Sign in. Ask a question. Get an answer with sources.
          </p>
          <Link
            href="/auth/login"
            className="mt-10 inline-block bg-[#14b8a6] px-10 py-4 text-sm font-semibold uppercase tracking-wider text-black transition-colors hover:bg-[#2dd4bf]"
          >
            Enter Cortex →
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-white/10 px-6 py-10 md:px-12">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Powered by Cortex
          </p>
          <Link
            href="/auth/login"
            className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 hover:text-[#14b8a6]"
          >
            Admin →
          </Link>
        </div>
      </footer>
    </div>
  );
}
