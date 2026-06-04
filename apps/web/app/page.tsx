import Link from 'next/link';
import { ArrowRight, Brain, Mail, MessageSquare, Plug, Sparkles, Zap } from 'lucide-react';
import { Badge, CortexLogo, GlassCard } from '@cortex/ui';

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -left-32 top-20 size-96 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 size-80 rounded-full bg-purple-500/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 size-72 rounded-full bg-cyan-500/10 blur-3xl" />

      <main className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
        <header className="mb-16 flex items-center justify-between">
          <CortexLogo />
          <Badge variant="cyan">Phase 1 · Brain Online</Badge>
        </header>

        <section className="mb-20 max-w-3xl">
          <h1 className="gradient-text gradient-text-glow text-5xl font-bold leading-tight tracking-tight md:text-6xl">
            The Single Brain for Your Entire Business
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[#94a3b8] md:text-xl">
            Connect every tool. Reason across organizational knowledge. Answer in seconds with
            cited, cross-tool intelligence — like Galvanite-grade AI infrastructure, built for
            your company OS.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/executive-desk" className="btn-gradient inline-flex items-center gap-2 px-6 py-3 text-sm">
              Try Executive Desk
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/clients-desk" className="btn-outline-glass inline-flex items-center gap-2 px-6 py-3 text-sm">
              <Mail className="size-4" />
              Clients Desk
            </Link>
            <Link href="/chat" className="btn-outline-glass inline-flex items-center gap-2 px-6 py-3 text-sm">
              <MessageSquare className="size-4" />
              Brain Chat
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Brain,
              title: 'Hybrid RAG Brain',
              desc: 'Vector search across Slack, Linear, GitHub, Gmail, and Notion — with source citations.',
            },
            {
              icon: Plug,
              title: '50+ Connectors Ready',
              desc: 'Hub-spoke model: Activepieces connectors feed the central knowledge hub.',
            },
            {
              icon: Sparkles,
              title: 'Executive + Client Desks',
              desc: 'Leadership chat and AI-drafted client replies with human-in-the-loop approval.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <GlassCard key={title} className="glass-hover group">
              <Icon className="mb-3 size-5 text-cyan-400 transition-transform duration-200 group-hover:scale-110" />
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">{desc}</p>
            </GlassCard>
          ))}
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Integrations', value: '5 live', icon: Plug },
            { label: 'Response time', value: '<60s', icon: Zap },
            { label: 'Knowledge docs', value: '12 seeded', icon: Brain },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="glass flex items-center gap-4 px-5 py-4">
              <Icon className="size-5 text-purple-400" />
              <div>
                <p className="font-mono text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-[#94a3b8]">{label}</p>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
