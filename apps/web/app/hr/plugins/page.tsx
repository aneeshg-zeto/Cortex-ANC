'use client';

import { useHr } from '@/components/hr/hr-context';
import { HrShell } from '@/components/hr/hr-shell';

export default function HrPluginsPage() {
  const { data, post } = useHr();

  async function toggle(pluginId: string, connected: boolean) {
    await post({
      action: connected ? 'plugin-disconnect' : 'plugin-connect',
      pluginId,
    });
  }

  return (
    <HrShell title="Plugins" subtitle="Connect external HR systems (Darwinbox, Keka, greytHR)">
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Use native Cortex HR for now, or connect your existing HRIS. Data from plugins will ingest
          into Cortex after employee onboarding.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(data?.pluginCatalog ?? []).map((plugin) => {
            const conn = data?.plugins.find((p) => p.pluginId === plugin.id);
            const connected = conn?.status === 'connected';
            return (
              <div key={plugin.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{plugin.name}</p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">
                      {plugin.category}
                    </p>
                  </div>
                  {plugin.comingSoon ? (
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-muted-foreground">
                      Soon
                    </span>
                  ) : connected ? (
                    <span className="rounded-full bg-[#a78bfa]/10 px-2 py-0.5 text-[10px] text-[#a78bfa]">
                      Connected
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{plugin.description}</p>
                {!plugin.comingSoon && (
                  <button
                    type="button"
                    onClick={() => toggle(plugin.id, connected)}
                    className={`mt-3 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      connected
                        ? 'border border-border text-muted-foreground hover:text-foreground'
                        : 'bg-[#a78bfa] text-[#0a0a0a]'
                    }`}
                  >
                    {connected ? 'Disconnect' : 'Connect'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </HrShell>
  );
}
