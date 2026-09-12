import { useEffect, useMemo, useState } from 'react';
import MobileWheelPicker from '../../components/MobileWheelPicker';
import {
  analyzeSoilReport,
  findNearbySoilLabs,
  getSoilAnalysisFileUrl,
  listSoilAnalyses,
  loadDistrictOptions,
  loadProvinceOptions,
  type SoilAnalysisRecord,
  type SoilLabResult,
} from '../../lib/soilAnalysisService';
import './soilAnalysis.css';
import { addPoints } from '../../gamification/useGamificationStore';
import {
  fetchSoilGridsProfile,
  type SoilGridsProfile,
} from '../../services/soilGridsService';

type Field = {
  id: string | number;
  name: string;
  crop?: string;
  area?: number;
  ada?: string | number;
  parsel?: string | number;
  city?: string;
  district?: string;
  village?: string;
  latitude?: number | null;
  longitude?: number | null;
  parcelCentroidLat?: number | null;
  parcelCentroidLng?: number | null;
};

type Props = {
  fields: Field[];
  selectedFieldId: string;
  onFieldChange: (id: string) => void;
  onBack: () => void;
  onOpenDemMap?: () => void;
  onOpenSentinel1Map?: () => void;
};

type LocationOption = {
  id: number;
  name: string;
};

const SAMPLE_STEPS = [
  {
    no: '1',
    image:
      'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=700&q=82',
    title: 'Tarlayı temsil edecek noktaları seç',
    short: 'Tek bir köşeden numune alma.',
    details:
      'Tarla homojense zikzak yürüyerek yaklaşık 8–15 farklı noktadan alt numune al. Gübre yığını, yol kenarı, su biriken çukur ve sıra dışı bölgeleri genel numuneye karıştırma.',
  },
  {
    no: '2',
    image:
      'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=700&q=82',
    title: 'Yüzeyi temizle ve uygun derinlikten al',
    short: 'Bitki artığını numuneye katma.',
    details:
      'Yüzeydeki yaprak, sap ve taşları uzaklaştır. Tarla bitkilerinde çoğu rutin analiz için 0–20/30 cm katman kullanılır. Özel analizlerde laboratuvarın istediği derinliği esas al.',
  },
  {
    no: '3',
    image:
      'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=700&q=82',
    title: 'Alt numuneleri temiz kapta karıştır',
    short: 'Homojen bir birleşik numune hazırla.',
    details:
      'Aynı derinlikten aldığın alt numuneleri temiz plastik kovada iyice karıştır. Çok ıslak toprağı kapalı poşette uzun süre bekletme.',
  },
  {
    no: '4',
    image:
      'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=700&q=82',
    title: 'Yaklaşık 0,5–1 kg temsili numune gönder',
    short: 'Etiketlemeyi unutma.',
    details:
      'Karışımın içinden laboratuvarın istediği miktarı ayır. Rutin toprak analizlerinde yaklaşık 500 g–1 kg çoğu durumda yeterlidir. Kesin miktarı laboratuvara sor.',
  },
];

export default function SoilAnalysisPage({
  fields,
  selectedFieldId,
  onFieldChange,
  onBack,
  onOpenDemMap,
  onOpenSentinel1Map,
}: Props) {
  const realFields = fields.filter(
    (field) => !String(field.id).startsWith('demo'),
  );

  const selectedField =
    fields.find((field) => String(field.id) === selectedFieldId) ??
    realFields[0] ??
    fields[0];

  const selectedFieldIsDemo = Boolean(
    selectedField && String(selectedField.id).startsWith('demo'),
  );

  useEffect(() => {
    if (selectedFieldIsDemo && realFields.length > 0) {
      onFieldChange(String(realFields[0].id));
    }
  }, [onFieldChange, realFields, selectedFieldIsDemo]);

  const [reportFile, setReportFile] = useState<File | null>(null);

  const [deviceLocation, setDeviceLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');

  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [locationOptionsLoading, setLocationOptionsLoading] = useState(false);

  const [labsLoading, setLabsLoading] = useState(false);
  const [labsMessage, setLabsMessage] = useState('');
  const [labs, setLabs] = useState<SoilLabResult[]>([]);

  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState('');

  const [latestAnalysis, setLatestAnalysis] =
    useState<SoilAnalysisRecord | null>(null);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<SoilAnalysisRecord[]>([]);

  const [soilGridsStatus, setSoilGridsStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [soilGridsProfile, setSoilGridsProfile] =
    useState<SoilGridsProfile | null>(null);
  const [soilGridsMessage, setSoilGridsMessage] = useState('');

  const fieldLat =
    selectedField?.parcelCentroidLat ?? selectedField?.latitude ?? null;

  const fieldLng =
    selectedField?.parcelCentroidLng ?? selectedField?.longitude ?? null;

  const hasFieldLocation =
    Number.isFinite(Number(fieldLat)) &&
    Number.isFinite(Number(fieldLng));

  const loadSoilGridsForSelectedField = async (
    forceRefresh = false,
    signal?: AbortSignal,
  ) => {
    if (!selectedField || selectedFieldIsDemo || !hasFieldLocation) {
      setSoilGridsStatus('idle');
      setSoilGridsProfile(null);
      setSoilGridsMessage(
        selectedFieldIsDemo
          ? 'Tahmini toprak profili gerçek bir tarla seçildiğinde hazırlanır.'
          : 'SoilGrids profili için seçili tarlada koordinat bulunmalı.',
      );
      return;
    }

    const latitude = Number(fieldLat);
    const longitude = Number(fieldLng);

    try {
      setSoilGridsStatus('loading');
      setSoilGridsMessage('');

      const profile = await fetchSoilGridsProfile(latitude, longitude, {
        forceRefresh,
        signal,
      });

      if (signal?.aborted) return;

      const primaryValues = [
        profile.properties.ph.topsoil0To30,
        profile.properties.organicCarbon.topsoil0To30,
        profile.texture.clayPercent,
        profile.texture.sandPercent,
        profile.texture.siltPercent,
      ];

      if (primaryValues.every((value) => value === null)) {
        throw new Error(
          profile.warnings[0] ||
            'SoilGrids bu koordinat için kullanılabilir değer döndürmedi.',
        );
      }

      setSoilGridsProfile(profile);
      setSoilGridsStatus('ready');

      if (profile.warnings.length > 0) {
        setSoilGridsMessage(
          `Profil hazır; ${profile.warnings.length} alt katman geçici olarak alınamadı.`,
        );
      }
    } catch (error) {
      if (signal?.aborted) return;

      setSoilGridsProfile(null);
      setSoilGridsStatus('error');
      setSoilGridsMessage(
        error instanceof Error
          ? error.message
          : 'Tahmini SoilGrids profili alınamadı.',
      );
    }
  };

  const province = provinces.find(
    (item) => String(item.id) === provinceId,
  );

  const district = districts.find(
    (item) => String(item.id) === districtId,
  );

  const effectiveLocation = useMemo(() => {
    if (deviceLocation) {
      return {
        source: 'device' as const,
        lat: deviceLocation.lat,
        lng: deviceLocation.lng,
        city: selectedField?.city ?? province?.name ?? '',
        district: selectedField?.district ?? district?.name ?? '',
        label: 'Cihaz konumu',
      };
    }

    if (hasFieldLocation) {
      return {
        source: 'field' as const,
        lat: Number(fieldLat),
        lng: Number(fieldLng),
        city: selectedField?.city ?? '',
        district: selectedField?.district ?? '',
        label: `${selectedField?.name ?? 'Seçili tarla'} konumu`,
      };
    }

    return {
      source: 'manual' as const,
      lat: null,
      lng: null,
      city: province?.name ?? '',
      district: district?.name ?? '',
      label:
        district?.name && province?.name
          ? `${district.name} / ${province.name}`
          : province?.name || 'İl / ilçe seçilmedi',
    };
  }, [
    deviceLocation,
    district?.name,
    fieldLat,
    fieldLng,
    hasFieldLocation,
    province?.name,
    selectedField?.city,
    selectedField?.district,
    selectedField?.name,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    void loadSoilGridsForSelectedField(false, controller.signal);

    return () => {
      controller.abort();
    };
    // Seçili tarla/koordinat değişince SoilGrids profilini yeniden hazırla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedField?.id,
    selectedFieldIsDemo,
    fieldLat,
    fieldLng,
    hasFieldLocation,
  ]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        setLocationOptionsLoading(true);

        const data = await loadProvinceOptions();

        if (mounted) {
          setProvinces(data);
        }
      } catch (error) {
        console.error('İller yüklenemedi:', error);
      } finally {
        if (mounted) {
          setLocationOptionsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!provinceId) {
      setDistricts([]);
      setDistrictId('');
      return;
    }

    let mounted = true;

    void (async () => {
      try {
        setLocationOptionsLoading(true);

        const data = await loadDistrictOptions(Number(provinceId));

        if (mounted) {
          setDistricts(data);
          setDistrictId('');
        }
      } catch (error) {
        console.error('İlçeler yüklenemedi:', error);
      } finally {
        if (mounted) {
          setLocationOptionsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [provinceId]);

  useEffect(() => {
    if (
      !selectedField?.id ||
      String(selectedField.id).startsWith('demo')
    ) {
      setHistory([]);
      return;
    }

    let mounted = true;

    void (async () => {
      try {
        setHistoryLoading(true);

        const rows = await listSoilAnalyses(
          String(selectedField.id),
        );

        if (mounted) {
          setHistory(rows);
          setLatestAnalysis(rows[0] ?? null);
        }
      } catch (error) {
        console.warn(
          'Toprak analiz geçmişi yüklenemedi:',
          error,
        );
      } finally {
        if (mounted) {
          setHistoryLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedField?.id]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage(
        'Bu cihaz konum paylaşımını desteklemiyor.',
      );
      return;
    }

    setLocationLoading(true);
    setLocationMessage('Konum alınıyor...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeviceLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        setLocationLoading(false);
        setLocationMessage('Cihaz konumu hazır.');
      },

      () => {
        setLocationLoading(false);

        setLocationMessage(
          'Konum izni verilmedi. Tarla konumu varsa onu, yoksa il / ilçe seçimini kullanabilirsin.',
        );
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  };

  const handleFindLabs = async () => {
    if (
      effectiveLocation.source === 'manual' &&
      (!effectiveLocation.city ||
        !effectiveLocation.district)
    ) {
      setLabs([]);

      setLabsMessage(
        'Cihaz veya tarla konumu yoksa önce il ve ilçe seç.',
      );

      return;
    }

    try {
      setLabsLoading(true);
      setLabsMessage('');

      const results = await findNearbySoilLabs({
        latitude: effectiveLocation.lat,
        longitude: effectiveLocation.lng,
        city: effectiveLocation.city,
        district: effectiveLocation.district,
      });

      setLabs(results);

      setLabsMessage(
        results.length
          ? `${results.length} analiz/laboratuvar sonucu bulundu. Gitmeden önce toprak analizi yaptıklarını telefonla doğrulaman iyi olur.`
          : 'Bu konum için sonuç bulunamadı. İl/ilçe değiştirerek tekrar deneyebilirsin.',
      );
    } catch (error) {
      setLabs([]);

      setLabsMessage(
        error instanceof Error
          ? error.message
          : 'Yakındaki laboratuvarlar getirilemedi.',
      );
    } finally {
      setLabsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedField) {
      setAnalysisMessage(
        'Önce analizin ait olduğu tarlayı seç.',
      );
      return;
    }

    if (String(selectedField.id).startsWith('demo')) {
      setAnalysisMessage(
        'Bu örnek tarla yalnızca önizleme içindir. Analiz sonucunu kaydedebilmek için Tarlalarım bölümünde kayıtlı gerçek bir tarla seçmelisin.',
      );
      return;
    }

    if (!reportFile) {
      setAnalysisMessage(
        'Önce PDF veya fotoğraf olarak analiz raporunu yükle.',
      );
      return;
    }

    try {
      setAnalysisLoading(true);

      setAnalysisMessage(
        'Rapor yükleniyor ve Toprak Analizi AI tarafından yorumlanıyor...',
      );

      const record = await analyzeSoilReport({
        file: reportFile,

        field: {
          id: String(selectedField.id),
          name: selectedField.name,
          crop: selectedField.crop ?? '',
          area: selectedField.area ?? null,
          ada: selectedField.ada ?? null,
          parsel: selectedField.parsel ?? null,
          city: selectedField.city ?? '',
          district: selectedField.district ?? '',
          village: selectedField.village ?? '',
        },
      });

      setLatestAnalysis(record);

      window.dispatchEvent(new CustomEvent('tp:field-context-updated', {
        detail: { fieldId: String(selectedField.id), changedFields: ['soil_analysis'], source: 'soil-analysis' },
      }));

      setHistory((current) => [
        record,
        ...current.filter(
          (item) => item.id !== record.id,
        ),
      ]);

      let pointMessage = '';

      try {
        const reward = await addPoints('ADD_SOIL_ANALYSIS', {
          dedupeKey: `soil-analysis:${String(record.id)}`,
          metadata: {
            source: 'soil_analysis',
            analysisId: String(record.id),
            fieldId: String(selectedField.id),
            fieldName: selectedField.name,
          },
          toastTitle: 'Toprak analizi ödülü',
        });

        if (reward.awarded && reward.awardedPoints > 0) {
          pointMessage = ` +${reward.awardedPoints} Puan kazandın.`;
        }
      } catch (pointError) {
        console.warn(
          'Toprak analizi puanı verilemedi; analiz kaydı korunuyor:',
          pointError,
        );
      }

      setAnalysisMessage(
        `AI yorumu hazır, sisteme kaydedildi ve PDF raporu oluşturuldu.${pointMessage}`,
      );
    } catch (error) {
      setAnalysisMessage(
        error instanceof Error
          ? error.message
          : 'Toprak analizi yorumlanamadı.',
      );
    } finally {
      setAnalysisLoading(false);
    }
  };

  const openStoredFile = async (
    path: string | null | undefined,
    kind: 'report' | 'pdf',
  ) => {
    if (!path) return;

    try {
      const url = await getSoilAnalysisFileUrl(path);

      window.open(
        url,
        '_blank',
        'noopener,noreferrer',
      );
    } catch (error) {
      setAnalysisMessage(
        error instanceof Error
          ? error.message
          : `${
              kind === 'pdf' ? 'PDF' : 'Rapor'
            } açılamadı.`,
      );
    }
  };

  return (
    <div className="soil-page">
      <header className="soil-topbar">
        <button
          type="button"
          onClick={onBack}
          aria-label="Ana sayfaya dön"
        >
          ←
        </button>

        <div>
          <strong>Toprak Analizi</strong>

          <small>
            Rapor · laboratuvar · numune · AI yorum · geçmiş
          </small>
        </div>
      </header>

      <main className="soil-main">

        {/* KAPAK */}

        <section className="soil-hero">
          <div className="soil-hero-shade" />

          <div className="soil-hero-copy">
            <span className="soil-kicker">
              TOPRAĞINI TANI · DOĞRU KARAR VER
            </span>

            <h1>
              Toprak analizini tarlan ve ürününle
              birlikte değerlendir.
            </h1>

            <p>
              Laboratuvar raporunu tarlaya bağla,
              uygun numune alma adımlarını gör,
              yakın analiz yerlerini bul ve raporu
              Toprak Analizi AI ile yorumlat.
            </p>

            <div className="soil-hero-tags">
              <span>🧪 Rapor Geçmişi</span>
              <span>📍 Yakın Laboratuvar</span>
              <span>✨ AI + PDF</span>
            </div>
          </div>
        </section>

        <section className="soil-grid">

          {/* SOILGRIDS TAHMİNİ PROFİL */}

          <article className="soil-card soil-soilgrids-card">
            <div className="soil-card-head soil-soilgrids-head">
              <span className="soil-card-icon soil-model-icon">◫</span>

              <div>
                <strong>Tahmini Toprak Profili</strong>
                <small>
                  ISRIC SoilGrids250m 2.0 · seçili tarla koordinatından
                </small>
              </div>

              <span className="soil-model-badge">250 m · MODEL</span>
            </div>

            <div className="soil-soilgrids-context">
              <div>
                <small>SEÇİLİ TARLA</small>
                <strong>{selectedField?.name ?? 'Tarla seçilmedi'}</strong>
              </div>

              <div>
                <small>VERİ TÜRÜ</small>
                <strong>Model tabanlı tahmin</strong>
              </div>

              <div className="soil-soilgrids-actions">
                <button
                  type="button"
                  onClick={() => void loadSoilGridsForSelectedField(true)}
                  disabled={
                    soilGridsStatus === 'loading' ||
                    !hasFieldLocation ||
                    selectedFieldIsDemo
                  }
                >
                  {soilGridsStatus === 'loading' ? 'Yükleniyor…' : 'Yenile'}
                </button>

                <button
                  type="button"
                  className="dem-map-button"
                  onClick={onOpenDemMap}
                  disabled={
                    !onOpenDemMap ||
                    !hasFieldLocation ||
                    selectedFieldIsDemo
                  }
                >
                  DEM Arazi Haritası
                </button>

                <button
                  type="button"
                  className="sentinel1-map-button"
                  onClick={onOpenSentinel1Map}
                  disabled={
                    !onOpenSentinel1Map ||
                    !hasFieldLocation ||
                    selectedFieldIsDemo
                  }
                >
                  Sentinel-1 Radar
                </button>
              </div>
            </div>

            {soilGridsStatus === 'loading' && (
              <div className="soil-soilgrids-state">
                <span className="soil-soilgrids-spinner" />
                <div>
                  <strong>Toprak profili hazırlanıyor</strong>
                  <p>
                    pH, organik karbon ve doku bileşenleri 0–30 cm
                    derinlik için SoilGrids rasterlarından okunuyor.
                  </p>
                </div>
              </div>
            )}

            {soilGridsStatus === 'idle' && (
              <div className="soil-soilgrids-state">
                <span>⌖</span>
                <div>
                  <strong>Koordinat bekleniyor</strong>
                  <p>
                    Gerçek ve koordinatı bulunan bir tarla seçildiğinde
                    tahmini profil otomatik hazırlanır.
                  </p>
                </div>
              </div>
            )}

            {soilGridsStatus === 'error' && (
              <div className="soil-soilgrids-state error">
                <span>!</span>
                <div>
                  <strong>Tahmini profil alınamadı</strong>
                  <p>
                    {soilGridsMessage ||
                      'SoilGrids servisine şu anda ulaşılamıyor.'}
                  </p>
                </div>
              </div>
            )}

            {soilGridsStatus === 'ready' && soilGridsProfile && (
              <>
                <div className="soil-soilgrids-metrics">
                  <article>
                    <small>pH · 0–30 cm</small>
                    <strong>
                      {soilGridsProfile.properties.ph.topsoil0To30 === null
                        ? '—'
                        : soilGridsProfile.properties.ph.topsoil0To30.toFixed(1)}
                    </strong>
                    <span>H₂O</span>
                  </article>

                  <article>
                    <small>Organik karbon</small>
                    <strong>
                      {soilGridsProfile.properties.organicCarbon
                        .topsoil0To30 === null
                        ? '—'
                        : soilGridsProfile.properties.organicCarbon.topsoil0To30.toFixed(
                            1,
                          )}
                    </strong>
                    <span>g/kg · 0–30 cm</span>
                  </article>

                  <article>
                    <small>Kil</small>
                    <strong>
                      {soilGridsProfile.texture.clayPercent === null
                        ? '—'
                        : `%${soilGridsProfile.texture.clayPercent.toFixed(1)}`}
                    </strong>
                    <span>0–30 cm</span>
                  </article>

                  <article>
                    <small>Kum</small>
                    <strong>
                      {soilGridsProfile.texture.sandPercent === null
                        ? '—'
                        : `%${soilGridsProfile.texture.sandPercent.toFixed(1)}`}
                    </strong>
                    <span>0–30 cm</span>
                  </article>

                  <article>
                    <small>Silt</small>
                    <strong>
                      {soilGridsProfile.texture.siltPercent === null
                        ? '—'
                        : `%${soilGridsProfile.texture.siltPercent.toFixed(1)}`}
                    </strong>
                    <span>0–30 cm</span>
                  </article>
                </div>

                <div className="soil-soilgrids-depths">
                  <div className="soil-soilgrids-depth-head">
                    <div>
                      <small>DERİNLİK PROFİLİ</small>
                      <strong>SoilGrids katmanları</strong>
                    </div>
                    <span>MEAN</span>
                  </div>

                  <div className="soil-soilgrids-depth-table">
                    <div className="head">
                      <span>Derinlik</span>
                      <span>pH</span>
                      <span>SOC</span>
                      <span>Kil</span>
                      <span>Kum</span>
                      <span>Silt</span>
                    </div>

                    {(['0-5cm', '5-15cm', '15-30cm'] as const).map(
                      (depth) => {
                        const layerValue = (
                          key:
                            | 'ph'
                            | 'organicCarbon'
                            | 'clay'
                            | 'sand'
                            | 'silt',
                        ) =>
                          soilGridsProfile.properties[key].layers.find(
                            (item) => item.depth === depth,
                          )?.value ?? null;

                        return (
                          <div className="row" key={depth}>
                            <span>{depth.replace('cm', ' cm')}</span>
                            <strong>
                              {layerValue('ph') === null
                                ? '—'
                                : layerValue('ph')?.toFixed(1)}
                            </strong>
                            <strong>
                              {layerValue('organicCarbon') === null
                                ? '—'
                                : `${layerValue('organicCarbon')?.toFixed(
                                    1,
                                  )} g/kg`}
                            </strong>
                            <strong>
                              {layerValue('clay') === null
                                ? '—'
                                : `%${layerValue('clay')?.toFixed(1)}`}
                            </strong>
                            <strong>
                              {layerValue('sand') === null
                                ? '—'
                                : `%${layerValue('sand')?.toFixed(1)}`}
                            </strong>
                            <strong>
                              {layerValue('silt') === null
                                ? '—'
                                : `%${layerValue('silt')?.toFixed(1)}`}
                            </strong>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>

                {soilGridsMessage && (
                  <p className="soil-soilgrids-message">{soilGridsMessage}</p>
                )}

                <div className="soil-soilgrids-disclaimer">
                  <span>i</span>
                  <div>
                    <strong>Laboratuvar sonucu her zaman önceliklidir.</strong>
                    <p>
                      Bu profil yaklaşık 250 m çözünürlüklü küresel bir
                      model tahminidir. Tarla içi ölçüm veya laboratuvar
                      analizi değildir; Pusula AI bunu yalnızca bağlamsal
                      veri olarak kullanmalıdır.
                    </p>
                  </div>
                </div>
              </>
            )}
          </article>


          {/* RAPOR */}

          <article className="soil-card soil-upload-card">

            <div className="soil-card-head">
              <span className="soil-card-icon">
                ▤
              </span>

              <div>
                <strong>
                  Analiz Raporu & Tarla
                </strong>

                <small>
                  AI yorumunun temel girdileri
                </small>
              </div>
            </div>

            <label
              className={`soil-upload ${reportFile ? 'has-file' : ''}`}
            >
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setReportFile(file);
                  setAnalysisMessage('');
                }}
              />

              <span>{reportFile ? '✓' : '↑'}</span>

              <strong>
                {reportFile?.name ||
                  'PDF veya fotoğraf olarak analiz raporunu yükle'}
              </strong>

              <small>
                {reportFile
                  ? `${Math.max(1, Math.round(reportFile.size / 1024))} KB · dosya seçildi`
                  : 'PDF · JPG · PNG · WEBP'}
              </small>
            </label>

            {reportFile && (
              <div className="soil-report-ready">
                <div>
                  <span>✓</span>
                  <div>
                    <strong>Rapor analize hazır</strong>
                    <small>
                      Tarlayı kontrol et, ardından aşağıdaki AI butonuyla analizi başlat.
                    </small>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setReportFile(null);
                    setAnalysisMessage('');
                  }}
                >
                  Değiştir
                </button>
              </div>
            )}

            <div className="soil-field-select">

              <span>
                BU RAPOR HANGİ TARLAYA AİT?
              </span>

              <MobileWheelPicker
                title="Analizin ait olduğu tarla"
                value={String(
                  selectedField?.id ?? '',
                )}
                onChange={onFieldChange}
                options={[...realFields, ...fields.filter(
                  (field) => String(field.id).startsWith('demo'),
                )].map((field) => {
                  const isDemo = String(field.id).startsWith('demo');

                  return {
                    value: String(field.id),
                    label: `${field.name}${field.crop ? ` · ${field.crop}` : ''}${
                      isDemo ? ' · ÖRNEK' : ''
                    }`,
                    description: isDemo
                      ? 'Önizleme tarlası · analiz kaydedilemez'
                      : field.area != null
                        ? `${field.area.toLocaleString('tr-TR')} da · ${
                            field.ada ?? '-'
                          } Ada / ${field.parsel ?? '-'} Parsel`
                        : '',
                  };
                })}
              />

              {selectedField && !selectedFieldIsDemo && (
                <p>
                  AI yorumu ve PDF{' '}
                  <strong>{selectedField.name}</strong>{' '}
                  kaydına bağlanacak.
                </p>
              )}

              {selectedFieldIsDemo && (
                <div className="soil-demo-warning">
                  <strong>Örnek tarla seçili</strong>
                  <span>
                    Bu kayıt yalnızca önizleme içindir. AI sonucunu kalıcı kaydetmek ve PDF oluşturmak için kayıtlı bir tarla seçmelisin.
                  </span>
                </div>
              )}
            </div>
          </article>

          {/* LABORATUVAR */}

          <article className="soil-card soil-location-card">

            <div className="soil-card-head">

              <span className="soil-card-icon green">
                ⌖
              </span>

              <div>
                <strong>
                  Yakınımdaki Analiz Laboratuvarları
                </strong>

                <small>
                  Konum sırası: cihaz → tarla → il/ilçe
                </small>
              </div>
            </div>

            <div className="soil-location-current">

              <span>📍</span>

              <div>
                <small>Aktif konum</small>

                <strong>
                  {effectiveLocation.label}
                </strong>
              </div>
            </div>

            <div className="soil-location-actions">

              <button
                type="button"
                onClick={requestLocation}
                disabled={locationLoading}
              >
                <span>◎</span>

                <div>
                  <strong>
                    {locationLoading
                      ? 'Konum alınıyor...'
                      : 'Cihaz Konumunu Kullan'}
                  </strong>

                  <small>
                    İzin açıksa birinci tercih
                  </small>
                </div>
              </button>

              <button
                type="button"
                className={
                  hasFieldLocation
                    ? 'available'
                    : ''
                }
                disabled={!hasFieldLocation}
                onClick={() =>
                  setDeviceLocation(null)
                }
              >
                <span>▱</span>

                <div>
                  <strong>
                    Tarla Konumunu Kullan
                  </strong>

                  <small>
                    {hasFieldLocation
                      ? `${
                          selectedField?.name ??
                          'Tarla'
                        } hazır`
                      : 'Seçili tarlada koordinat yok'}
                  </small>
                </div>
              </button>
            </div>

            {!deviceLocation &&
              !hasFieldLocation && (
                <div className="soil-location-pickers">

                  <span>
                    KONUMU İL / İLÇE İLE SEÇ
                  </span>

                  <div>

                    <MobileWheelPicker
                      title="İl seç"
                      value={provinceId}
                      onChange={setProvinceId}
                      options={provinces.map(
                        (item) => ({
                          value: String(item.id),
                          label: item.name,
                        }),
                      )}
                      placeholder={
                        locationOptionsLoading
                          ? 'İller yükleniyor...'
                          : 'İl seç'
                      }
                    />

                    <MobileWheelPicker
                      title="İlçe seç"
                      value={districtId}
                      onChange={setDistrictId}
                      options={districts.map(
                        (item) => ({
                          value: String(item.id),
                          label: item.name,
                        }),
                      )}
                      disabled={
                        !provinceId ||
                        locationOptionsLoading
                      }
                      placeholder={
                        !provinceId
                          ? 'Önce il seç'
                          : locationOptionsLoading
                            ? 'İlçeler yükleniyor...'
                            : 'İlçe seç'
                      }
                    />

                  </div>
                </div>
              )}

            {locationMessage && (
              <p className="soil-location-message">
                {locationMessage}
              </p>
            )}

            <button
              type="button"
              className="soil-outline-button"
              onClick={handleFindLabs}
              disabled={labsLoading}
            >
              {labsLoading
                ? 'Laboratuvarlar aranıyor...'
                : 'Yakındaki Laboratuvarları Bul →'}
            </button>

            {labsMessage && (
              <p className="soil-labs-message">
                {labsMessage}
              </p>
            )}

            {labs.length > 0 && (
              <div className="soil-labs-list">

                {labs.map((lab) => (
                  <div
                    key={`${lab.name}-${lab.latitude}-${lab.longitude}`}
                  >
                    <span className="soil-lab-pin">
                      ⌖
                    </span>

                    <div>
                      <strong>
                        {lab.name}
                      </strong>

                      <small>
                        {lab.address ||
                          'Adres bilgisi sınırlı'}
                      </small>

                      <div className="soil-lab-meta">

                        {lab.distanceKm != null && (
                          <span>
                            {lab.distanceKm.toFixed(
                              1,
                            )}{' '}
                            km
                          </span>
                        )}

                        {lab.phone && (
                          <span>
                            {lab.phone}
                          </span>
                        )}

                      </div>
                    </div>

                    {lab.mapUrl && (
                      <a
                        href={lab.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Yol
                      </a>
                    )}
                  </div>
                ))}

              </div>
            )}

          </article>

          {/* NUMUNE ALMA */}

          <article className="soil-card soil-guide">

            <div className="soil-card-head">

              <span className="soil-card-icon amber">
                ✓
              </span>

              <div>
                <strong>
                  Numune Nasıl Alınır?
                </strong>

                <small>
                  Genel tarla numunesi için
                  pratik rehber
                </small>
              </div>
            </div>

            <div className="soil-steps">

              {SAMPLE_STEPS.map((step) => (
                <article key={step.no}>

                  <div className="soil-step-photo">

                    <img
                      src={step.image}
                      alt=""
                    />

                    <span>
                      {step.no}
                    </span>

                  </div>

                  <div className="soil-step-copy">

                    <strong>
                      {step.title}
                    </strong>

                    <em>
                      {step.short}
                    </em>

                    <p>
                      {step.details}
                    </p>

                  </div>
                </article>
              ))}

            </div>

            <div className="soil-sample-note">

              <strong>Not:</strong>{' '}
              Numune derinliği, miktarı ve
              ambalajı analiz türüne göre
              değişebilir. Özellikle meyve
              bahçesi, sera, tuzluluk, ağır
              metal veya özel besin
              analizlerinde laboratuvarın
              numune kabul talimatını esas al.

            </div>
          </article>

        </section>

        {/* AI */}

        <section className="soil-ai">

          <div className="soil-ai-head">

            <div className="soil-ai-icon">
              ✦
            </div>

            <div>

              <span>
                TOPRAK ANALİZİ AI · GEMINI
              </span>

              <h2>
                Raporu okur, değerleri çıkarır
                ve seçili ürüne göre yorumlar.
              </h2>

              <p>
                Bu özellik genel chatbot gibi
                kullanılmaz; yalnızca yüklediğin
                toprak analiz raporunu ve seçtiğin
                tarla/ürün bağlamını değerlendirir.
              </p>

            </div>

            <span className="soil-ai-badge">
              AI + PDF
            </span>

          </div>

          <div className="soil-ai-flow">

            <div>
              <span>1</span>
              <strong>Rapor</strong>
              <small>
                {reportFile
                  ? 'Hazır'
                  : 'Yükle'}
              </small>
            </div>

            <i>→</i>

            <div>
              <span>2</span>
              <strong>Tarla</strong>
              <small>
                {selectedField?.name ??
                  'Seç'}
              </small>
            </div>

            <i>→</i>

            <div>
              <span>3</span>
              <strong>Gemini</strong>
              <small>
                Değerleri çıkarır
              </small>
            </div>

            <i>→</i>

            <div>
              <span>4</span>
              <strong>Kayıt + PDF</strong>
              <small>
                Geçmişe eklenir
              </small>
            </div>

          </div>

          <button
            type="button"
            className="soil-ai-button"
            disabled={
              !reportFile ||
              !selectedField ||
              selectedFieldIsDemo ||
              analysisLoading
            }
            onClick={handleAnalyze}
          >
            {analysisLoading
              ? '✨ Toprak Analizi AI raporu yorumluyor...'
              : '✨ AI ile Yorumla · Kaydet · PDF Oluştur'}
          </button>

          {analysisMessage && (
            <div className="soil-ai-message">
              {analysisMessage}
            </div>
          )}

          {latestAnalysis?.ai_result && (
            <div className="soil-ai-result">

              <div className="soil-ai-result-head">

                <div>
                  <span>
                    SON AI YORUMU
                  </span>

                  <h3>
                    {latestAnalysis.summary ||
                      'Toprak analizi yorumu'}
                  </h3>
                </div>

                <strong
                  className={`soil-status soil-status-${
                    latestAnalysis.status ??
                    'unknown'
                  }`}
                >
                  {latestAnalysis.status_label ||
                    'Değerlendirildi'}
                </strong>

              </div>

              <div className="soil-ai-result-grid">

                <div>
                  <h4>
                    Toprak Özeti
                  </h4>

                  <p>
                    {
                      latestAnalysis.ai_result
                        .soilSummary
                    }
                  </p>
                </div>

                <div>
                  <h4>
                    Ürüne Göre Yorum
                  </h4>

                  <p>
                    {
                      latestAnalysis.ai_result
                        .cropInterpretation
                    }
                  </p>
                </div>

                <div>
                  <h4>
                    Dikkat Gerekenler
                  </h4>

                  <ul>
                    {(
                      latestAnalysis.ai_result
                        .attentionPoints ?? []
                    ).map((item) => (
                      <li key={item}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4>
                    Öneriler
                  </h4>

                  <ul>
                    {(
                      latestAnalysis.ai_result
                        .recommendations ?? []
                    ).map((item) => (
                      <li key={item}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

              </div>

              <div className="soil-ai-result-actions">

                <button
                  type="button"
                  onClick={() =>
                    void openStoredFile(
                      latestAnalysis.report_path,
                      'report',
                    )
                  }
                >
                  Orijinal Rapor
                </button>

                <button
                  type="button"
                  className="primary"
                  onClick={() =>
                    void openStoredFile(
                      latestAnalysis.pdf_path,
                      'pdf',
                    )
                  }
                >
                  AI PDF Raporunu Aç
                </button>

              </div>

            </div>
          )}

        </section>

        {/* GEÇMİŞ */}

        <section className="soil-history">

          <div className="soil-history-head">

            <div>
              <span>
                ANALİZ GEÇMİŞİ
              </span>

              <h2>
                {selectedField?.name ??
                  'Seçili Tarla'}
              </h2>
            </div>

            <small>
              {history.length} kayıt
            </small>

          </div>

          {historyLoading ? (

            <div className="soil-empty">
              Analiz geçmişi yükleniyor...
            </div>

          ) : history.length === 0 ? (

            <div className="soil-empty">

              <span>🧾</span>

              <strong>
                Henüz kayıtlı toprak analizi yok
              </strong>

              <p>
                İlk AI yorumunu oluşturduğunda
                rapor, yorum ve PDF bu tarlanın
                geçmişine kaydedilecek.
              </p>

            </div>

          ) : (

            <div className="soil-history-list">

              {history.map((item) => (

                <article key={item.id}>

                  <div>

                    <span>
                      {new Date(
                        item.created_at,
                      ).toLocaleDateString(
                        'tr-TR',
                      )}
                    </span>

                    <strong>
                      {item.summary ||
                        'Toprak Analizi'}
                    </strong>

                    <small>
                      {item.crop
                        ? `${item.crop} · `
                        : ''}

                      {item.status_label ||
                        'Değerlendirildi'}
                    </small>

                  </div>

                  <div className="soil-history-actions">

                    <button
                      type="button"
                      onClick={() =>
                        setLatestAnalysis(
                          item,
                        )
                      }
                    >
                      Yorumu Gör
                    </button>

                    <button
                      type="button"
                      disabled={!item.pdf_path}
                      onClick={() =>
                        void openStoredFile(
                          item.pdf_path,
                          'pdf',
                        )
                      }
                    >
                      PDF
                    </button>

                  </div>

                </article>

              ))}

            </div>
          )}

        </section>

      </main>
    </div>
  );
}
