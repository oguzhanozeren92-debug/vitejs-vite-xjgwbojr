import './MapDataDate.css';

function measurementDate(value: unknown): string | null {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

type Props = {
  layer?: string;
  latestDate?: unknown;
  radarRange?: { from?: string; to?: string };
  hasData: boolean;
};

export default function MapDataDate({ layer = 'vegetation', latestDate, radarRange, hasData }: Props) {
  const date = measurementDate(latestDate);
  const from = measurementDate(radarRange?.from);
  const to = measurementDate(radarRange?.to);
  const title = !hasData ? null
    : layer === 'vegetation' ? `NDVI · ${date ?? 'ölçüm tarihi bilinmiyor'}`
    : layer.startsWith('radar-') ? `Radar dönemi · ${from && to ? `${from} – ${to}` : 'bilinmiyor'}`
    : 'Katman tarihi bilinmiyor';

  return (
    <div className="tp-measurement-date" role="status" aria-label="Harita veri tarihi">
      <strong>{title ?? 'Veri tarihi yok'}</strong>
    </div>
  );
}
