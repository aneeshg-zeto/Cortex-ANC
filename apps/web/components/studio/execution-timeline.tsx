'use client';

import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

export type ExecutionStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  detail?: string;
};

function StepIcon({ status }: { status: ExecutionStep['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2 className="size-3.5 animate-spin text-[#14b8a6]" />;
    case 'done':
      return <CheckCircle2 className="size-3.5 text-emerald-400" />;
    case 'failed':
      return <XCircle className="size-3.5 text-red-400" />;
    default:
      return <Circle className="size-3.5 text-muted-foreground" />;
  }
}

export function ExecutionTimeline({ steps }: { steps: ExecutionStep[] }) {
  if (!steps.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 px-4 py-2">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-1">
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] ${
              step.status === 'running'
                ? 'border-[#14b8a6]/40 bg-[#14b8a6]/10 text-[#14b8a6]'
                : step.status === 'done'
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
                  : step.status === 'failed'
                    ? 'border-red-500/30 bg-red-500/5 text-red-300'
                    : 'border-zinc-700 text-muted-foreground'
            }`}
          >
            <StepIcon status={step.status} />
            <span>{step.label}</span>
            {step.detail ? <span className="text-muted-foreground">· {step.detail}</span> : null}
          </div>
          {i < steps.length - 1 ? (
            <span className="mx-0.5 text-[10px] text-muted-foreground">→</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function buildIngestionSteps(
  providers: { provider: string; processed: number; total: number; status: string }[],
): ExecutionStep[] {
  const phases = ['Fetch', 'Parse', 'Embed', 'Index'];
  const steps: ExecutionStep[] = [];

  for (const p of providers) {
    const label = p.provider.replace('-workspace', '');
    const ratio = p.total > 0 ? p.processed / p.total : p.processed > 0 ? 0.5 : 0;
    const phaseIdx =
      p.status === 'completed'
        ? 3
        : p.status === 'failed'
          ? -1
          : ratio < 0.25
            ? 0
            : ratio < 0.55
              ? 1
              : ratio < 0.85
                ? 2
                : 3;

    steps.push({
      id: `${p.provider}-fetch`,
      label: `${label}: Fetch`,
      status:
        p.status === 'failed'
          ? 'failed'
          : phaseIdx > 0 || p.status === 'completed'
            ? 'done'
            : p.status === 'running'
              ? 'running'
              : 'pending',
      detail: p.status === 'running' ? `${p.processed}/${p.total || '…'}` : undefined,
    });
    for (let i = 1; i < phases.length; i++) {
      const phase = phases[i];
      steps.push({
        id: `${p.provider}-${phase.toLowerCase()}`,
        label: `${label}: ${phase}`,
        status:
          p.status === 'completed'
            ? 'done'
            : p.status === 'failed' && phaseIdx === i
              ? 'failed'
              : phaseIdx > i
                ? 'done'
                : phaseIdx === i && p.status === 'running'
                  ? 'running'
                  : 'pending',
      });
    }
  }

  return steps.slice(0, 12);
}
