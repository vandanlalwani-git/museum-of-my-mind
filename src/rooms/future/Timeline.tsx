import type { Outlook } from './model';

interface Props { outlook: Outlook; goalTitle: string }

const W = 1000, H = 420, PAD_L = 200, PAD_R = 60, TOP = 96, ROW = 34;

/**
 * Twelve months as a wide instrument face. Each unfinished project is a track
 * whose line rises with progress; the goal star at 3, 6, and 12 months
 * brightens with the average. Milestones flag where a project could finish.
 */
export function Timeline({ outlook, goalTitle }: Props) {
  const rows = outlook.projects;
  const height = Math.max(H, TOP + rows.length * ROW + 80);
  const x = (m: number) => PAD_L + (m / 12) * (W - PAD_L - PAD_R);
  const trackY = (i: number) => TOP + 40 + i * ROW;

  return (
    <svg className="fg-timeline" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={timelineLabel(outlook, goalTitle)}>
      {/* month ticks */}
      {Array.from({ length: 13 }, (_, m) => (
        <g key={m}>
          <line x1={x(m)} x2={x(m)} y1={TOP - 4} y2={height - 40} className={`fg-tick ${m === 3 || m === 6 || m === 12 ? 'is-major' : ''}`} />
          {(m === 0 || m === 3 || m === 6 || m === 12) && (
            <text x={x(m)} y={height - 22} textAnchor="middle" className="fg-tick-label">{m === 0 ? 'now' : `${m} months`}</text>
          )}
        </g>
      ))}

      {/* goal stars at horizons */}
      {[3, 6, 12].map((m, i) => {
        const b = outlook.brightness[i]!;
        return (
          <g key={m} transform={`translate(${x(m)} ${TOP - 40})`}>
            <circle r={18 + b * 26} className="fg-star-glow" style={{ opacity: 0.15 + b * 0.5 }} />
            <circle r={3 + b * 4} className="fg-star" style={{ opacity: 0.5 + b * 0.5 }} />
            <text y={-32 - b * 10} textAnchor="middle" className="fg-star-label">{Math.round(b * 100)}% bright</text>
          </g>
        );
      })}
      <text x={PAD_L - 16} y={TOP - 36} textAnchor="end" className="fg-goal-label">{truncate(goalTitle, 30)}</text>

      {/* project tracks */}
      {rows.map((p, i) => {
        const y = trackY(i);
        const d = p.path.map((v, m) => `${m === 0 ? 'M' : 'L'}${x(m)} ${y - v * (ROW - 8)}`).join(' ');
        const area = `${d} L${x(12)} ${y} L${x(0)} ${y} Z`;
        return (
          <g key={p.projectId} className={`fg-track ${p.worked ? 'is-worked' : 'is-waiting'} fg-track--${p.status}`}>
            <text x={PAD_L - 16} y={y - 4} textAnchor="end" className="fg-track-label">{truncate(p.title, 28)}</text>
            <line x1={x(0)} x2={x(12)} y1={y} y2={y} className="fg-track-base" />
            <path d={area} className="fg-track-area" />
            <path d={d} className="fg-track-line" />
            {p.finishMonth !== null && (
              <g transform={`translate(${x(p.finishMonth)} ${y - (ROW - 8)})`}>
                <circle r={4} className="fg-milestone" />
                <text x={8} y={-6} className="fg-milestone-label">could finish · month {p.finishMonth}</text>
              </g>
            )}
            {!p.worked && <text x={x(12) + 8} y={y - 4} className="fg-waits">waits</text>}
          </g>
        );
      })}
      {rows.length === 0 && (
        <text x={(PAD_L + W - PAD_R) / 2} y={TOP + 60} textAnchor="middle" className="fg-empty-text">Nothing unfinished serves this goal yet.</text>
      )}
    </svg>
  );
}

function timelineLabel(o: Outlook, goal: string): string {
  const parts = o.projects.map((p) => `${p.title}: ${Math.round((p.path[12] ?? 0) * 100)} percent by month twelve${p.finishMonth ? `, could finish in month ${p.finishMonth}` : ''}${p.worked ? '' : ' (waiting)'}`);
  return `Twelve-month what-if for ${goal}. Goal brightness ${o.brightness.map((b) => Math.round(b * 100)).join(', ')} percent at three, six, and twelve months. ${parts.join('. ')}`;
}
function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
