import type { HomeFieldDataStatusItem } from '../components/HomeFieldDataStatus';
import { isRecentSatelliteObservation } from '../../satellite/services/buildHomeSatelliteDecision';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type Sources = {
  weather: { status?: string | null; available: boolean };
  phenology: { status: LoadStatus; usable: boolean; stageLabel?: string | null };
  satellite: { status: LoadStatus; quality?: string; observationCount: number; latestDate?: string | null };
  soil: { status: LoadStatus; reportDate?: string | null };
  irrigation: { status: LoadStatus; decisionCode?: string | null };
};

function dayLabel(value: string | null | undefined) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
    : null;
}

export function buildHomeFieldDataStatuses(sources: Sources): HomeFieldDataStatusItem[] {
  const { weather, phenology, satellite, soil, irrigation } = sources;
  const satelliteDate = dayLabel(satellite.latestDate);
  const satelliteRecent = satellite.quality === 'usable' && isRecentSatelliteObservation(satellite.latestDate);
  const reportDate = dayLabel(soil.reportDate);

  return [
    {
      label: 'Hava durumu',
      status: weather.status === 'error' ? 'error' : weather.available ? 'ready' : weather.status === 'loading' ? 'loading' : 'missing',
      detail: weather.status === 'error' ? 'Veri alınamadı' : weather.available ? 'Güncel hava verisi var' : weather.status === 'loading' ? 'Yükleniyor' : 'Hava verisi yok',
    },
    {
      label: 'Ürün evresi',
      status: phenology.status === 'error' ? 'error' : phenology.status === 'loading' ? 'loading' : phenology.usable ? 'ready' : 'missing',
      detail: phenology.status === 'error' ? 'Veri alınamadı' : phenology.status === 'loading' ? 'Hesaplanıyor' : phenology.usable ? phenology.stageLabel || 'Evre bilgisi var' : 'Evre için veri eksik',
    },
    {
      label: 'Uydu NDVI',
      status: satellite.status === 'error' ? 'error' : satellite.status === 'loading' ? 'loading' : satelliteRecent ? 'ready' : 'missing',
      detail: satellite.status === 'error' ? 'Veri alınamadı' : satellite.status === 'loading' ? 'Gözlemler yükleniyor' : satelliteRecent && satelliteDate ? `Son gözlem ${satelliteDate} · ${satellite.observationCount} kayıt` : satelliteDate ? `Son gözlem ${satelliteDate}; güncel eğilim yok` : 'Güvenilir gözlem henüz yok',
    },
    {
      label: 'Toprak analizi',
      status: soil.status === 'error' ? 'error' : soil.status === 'loading' ? 'loading' : soil.status === 'ready' && soil.reportDate ? 'ready' : 'missing',
      detail: soil.status === 'error' ? 'Veri alınamadı' : soil.status === 'loading' ? 'Raporlar yükleniyor' : reportDate ? `Son rapor ${reportDate}` : 'Henüz rapor yok',
    },
    {
      label: 'Sulama',
      status: irrigation.status === 'error' ? 'error' : irrigation.status === 'loading' ? 'loading' : irrigation.status === 'ready' && irrigation.decisionCode && irrigation.decisionCode !== 'needs_data' ? 'ready' : 'missing',
      detail: irrigation.status === 'error' ? 'Veri alınamadı' : irrigation.status === 'loading' ? 'Değerlendiriliyor' : irrigation.decisionCode === 'needs_data' ? 'Sulama bilgisi eksik' : irrigation.status === 'ready' && irrigation.decisionCode ? 'Değerlendirme hazır' : 'Sulama verisi yok',
    },
  ];
}
