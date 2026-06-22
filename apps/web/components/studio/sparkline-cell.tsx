'use client';

type SparklineCellProps = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
};

export function SparklineCell({
  data,
  width = 56,
  height = 20,
  color = '#14b8a6',
}: SparklineCellProps) {
  if (!data.length) return <span className="text-[10px] text-muted-foreground">—</span>;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * width;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function conditionalSalaryClass(salary: number, median: number): string {
  if (median <= 0) return 'text-foreground/80';
  const ratio = salary / median;
  if (ratio >= 1.2) return 'text-emerald-400';
  if (ratio <= 0.8) return 'text-amber-400';
  return 'text-foreground/80';
}

export function conditionalStatusClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/10 text-emerald-400';
    case 'on_leave':
      return 'bg-amber-500/10 text-amber-300';
    case 'inactive':
      return 'bg-zinc-700/50 text-muted-foreground';
    default:
      return 'bg-[#a78bfa]/10 text-[#a78bfa]';
  }
}
