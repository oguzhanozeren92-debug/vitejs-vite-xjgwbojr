import { useEffect, useMemo, useRef, useState } from 'react';
import MobileWheelPicker from '../../components/MobileWheelPicker';
import PusulaGuide, { type PusulaInsight } from '../../assets/pusula/PusulaGuide';
import {
  synthesizeFieldObservations,
  type FieldSynthesisResult,
} from '../../services/unifiedMapAiService';
import { onboardingStyles } from '../../styles/onboardingStyles';
import type { UnifiedClimateContext } from '../../features/weather/hooks/useAppWeatherData';
import type {
  AiAccessStatus,
  AiFieldAnalysis,
  CmsBlockRow,
  CmsPageRow,
  Field,
  FieldWeatherState,
  Screen,
} from '../../types';

type Setter<T> = (value: T) => void;


const PUSULA_BODY_SRC =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-body.webp';

function confidenceToTurkish(
  value: 'dusuk' | 'orta' | 'yuksek',
): 'Düşük' | 'Orta' | 'Yüksek' {
  if (value === 'yuksek') return 'Yüksek';
  if (value === 'dusuk') return 'Düşük';
  return 'Orta';
}

const PUSULA_AI_EXTRA_STYLES = `
  .tp-pusula-synthesis{position:relative;overflow:hidden;border:1px solid rgba(205,178,109,.25);border-radius:24px;padding:20px;margin-bottom:20px;background:radial-gradient(circle at 85% 15%,rgba(205,178,109,.12),transparent 32%),linear-gradient(145deg,rgba(12,28,20,.98),rgba(7,17,13,.98));color:#f1ead8;box-shadow:0 22px 70px rgba(0,0,0,.25)}
  .tp-pusula-synthesis-head{display:flex;align-items:center;justify-content:space-between;gap:16px}
  .tp-pusula-synthesis-kicker{display:block;margin-bottom:5px;color:#cdb26d;font-size:11px;font-weight:900;letter-spacing:.13em}
  .tp-pusula-synthesis-copy h2{margin:0;color:#f4eddb;font-size:22px;line-height:1.12}
  .tp-pusula-synthesis-copy p{margin:7px 0 0;color:#9fa99f;font-size:13px;line-height:1.5}
  .tp-pusula-synthesis-anchor{flex:0 0 66px;width:66px;height:66px;border:0;padding:0;border-radius:50%;background:transparent;cursor:pointer}
  .tp-pusula-synthesis-anchor img{width:100%;height:100%;object-fit:contain;display:block}
  .tp-pusula-synthesis-anchor.loading img{animation:tpPusulaThinking 1.15s ease-in-out infinite}
  @keyframes tpPusulaThinking{0%{transform:rotate(-5deg) scale(.98)}45%{transform:rotate(7deg) scale(1.04)}100%{transform:rotate(-5deg) scale(.98)}}
  .tp-pusula-synthesis-progress,.tp-pusula-synthesis-empty,.tp-pusula-synthesis-error{margin-top:16px;padding:14px 15px;border-radius:16px;border:1px solid rgba(205,178,109,.14);background:rgba(255,255,255,.025)}
  .tp-pusula-synthesis-error{color:#e8b2ac;border-color:rgba(220,94,85,.22);background:rgba(190,71,63,.10)}
  .tp-pusula-synthesis-result{margin-top:18px}
  .tp-pusula-synthesis-status{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:15px;border-bottom:1px solid rgba(205,178,109,.12)}
  .tp-pusula-synthesis-status span{display:block;margin-bottom:4px;color:#89978f;font-size:10px;font-weight:800;letter-spacing:.12em}
  .tp-pusula-synthesis-status strong{color:#f4eddb;font-size:18px;line-height:1.2}
  .tp-pusula-status-pill{flex:0 0 auto;padding:7px 10px;border-radius:999px;font-size:10px;font-weight:900}
  .tp-pusula-status-pill.normal{color:#83d89a;background:rgba(66,163,94,.12)}
  .tp-pusula-status-pill.dikkat{color:#e3c270;background:rgba(203,159,58,.11)}
  .tp-pusula-status-pill.kontrol{color:#e69a91;background:rgba(190,71,63,.10)}
  .tp-pusula-main-summary{margin:15px 0 0;color:#c4cec5;font-size:13px;line-height:1.65}
  .tp-pusula-important-area,.tp-pusula-action{margin-top:15px;padding:13px 14px;border-radius:15px;background:rgba(205,178,109,.07);border:1px solid rgba(205,178,109,.16)}
  .tp-pusula-important-area span,.tp-pusula-action span{display:block;color:#b59c61;font-size:9px;font-weight:900;letter-spacing:.11em}
  .tp-pusula-important-area strong{display:block;margin-top:4px;color:#f2e9d2;text-transform:capitalize}
  .tp-pusula-important-area p,.tp-pusula-action p{margin:5px 0 0;color:#aeb9b0;font-size:12px;line-height:1.5}
  .tp-pusula-section{margin-top:17px}.tp-pusula-section-title{display:block;margin-bottom:8px;color:#a7b1a9;font-size:10px;font-weight:900;letter-spacing:.10em}
  .tp-pusula-causes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.tp-pusula-cause{padding:12px;border-radius:14px;background:rgba(255,255,255,.027);border:1px solid rgba(255,255,255,.05)}
  .tp-pusula-cause strong{color:#e8e2d2;font-size:12px}.tp-pusula-cause p{margin:6px 0 0;color:#8f9c94;font-size:11px;line-height:1.5}
  .tp-pusula-evidence{display:grid;gap:7px}.tp-pusula-evidence-row{display:grid;grid-template-columns:105px minmax(0,1fr);gap:10px;padding:10px 11px;border-radius:12px;background:rgba(255,255,255,.022)}
  .tp-pusula-evidence-row strong{color:#cdb26d;font-size:10px}.tp-pusula-evidence-row span{color:#aab6ae;font-size:11px;line-height:1.45}
  .tp-pusula-synthesis-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:15px}.tp-pusula-refresh{border:1px solid rgba(205,178,109,.18);border-radius:11px;padding:8px 11px;background:rgba(205,178,109,.05);color:#d1bb7f;cursor:pointer;font-size:10px;font-weight:800}
  .tp-pusula-caution{margin-top:13px;color:#69776f;font-size:9px;line-height:1.45}
  @media(max-width:680px){.tp-pusula-synthesis{padding:16px;border-radius:20px}.tp-pusula-causes{grid-template-columns:1fr}}
`;


type AiAnalysisScreenProps = {
  cmsRuntimeCss: string;
  cmsPageFor: (pageKey: string) => CmsPageRow | undefined;
  cmsBlockFor: (pageKey: string, blockKey: string) => CmsBlockRow | undefined;
  cmsText: (block: CmsBlockRow | undefined, fallback: string) => string;
  cmsSub: (block: CmsBlockRow | undefined, fallback: string) => string;

  aiAccessStatus: AiAccessStatus | null;
  aiAccessLoading: boolean;

  realFields: Field[];
  fieldWeather: Record<string, FieldWeatherState>;
  loadFieldWeather: (field: Field) => void | Promise<void>;
  unifiedClimateContext: UnifiedClimateContext | null;
  selectedField: Field | null;
  setSelectedField: Setter<Field | null>;

  activityPhotoPreview: string;
  activityPhoto: File | null;
  activityNotes: string;
  setActivityNotes: Setter<string>;

  aiAnalyzing: boolean;
  aiAnalysisError: string;
  aiAnalysis: AiFieldAnalysis | null;
  activityFormLoading: boolean;

  setScreen: Setter<Screen>;
  clearActivityPhoto: () => void;
  handleActivityPhotoChange: (file?: File) => void | Promise<void>;
  handleAiAnalyzeActivityPhoto: () => void | Promise<void>;
  handleAddActivity: () => void | Promise<void>;
  openAddField: () => void;
  openCalendarScreen: () => void;
};

export default function AiAnalysisScreen({
  cmsRuntimeCss,
  cmsPageFor,
  cmsBlockFor,
  cmsText,
  cmsSub,
  aiAccessStatus,
  aiAccessLoading,
  realFields,
  fieldWeather,
  loadFieldWeather,
  unifiedClimateContext,
  selectedField,
  setSelectedField,
  activityPhotoPreview,
  activityPhoto,
  activityNotes,
  setActivityNotes,
  aiAnalyzing,
  aiAnalysisError,
  aiAnalysis,
  activityFormLoading,
  setScreen,
  clearActivityPhoto,
  handleActivityPhotoChange,
  handleAiAnalyzeActivityPhoto,
  handleAddActivity,
  openAddField,
  openCalendarScreen,
}: AiAnalysisScreenProps) {
  const aiPage = cmsPageFor('aiAnalysis');
  const aiHeaderBlock = cmsBlockFor('aiAnalysis', 'page-header');
  const aiHeroBlock = cmsBlockFor('aiAnalysis', 'hero');
  const aiAccessBlock = cmsBlockFor('aiAnalysis', 'access');
  const aiFieldStepBlock = cmsBlockFor('aiAnalysis', 'field-step');
  const aiPhotoStepBlock = cmsBlockFor('aiAnalysis', 'photo-step');
  const aiPickerBlock = cmsBlockFor('aiAnalysis', 'photo-picker');
  const aiNoteBlock = cmsBlockFor('aiAnalysis', 'note');
  const aiAnalyzeBlock = cmsBlockFor('aiAnalysis', 'analyze-button');

  const canAnalyze =
    aiAccessStatus?.unlimited ||
    (aiAccessStatus?.freeRemaining ?? 0) > 0 ||
    (aiAccessStatus?.rewardCredits ?? 0) > 0;


  const synthesisField = selectedField ?? realFields[0] ?? null;

  const synthesisWeather =
    synthesisField
      ? fieldWeather[String(synthesisField.id)] ?? null
      : null;

  useEffect(() => {
    if (!synthesisField?.id) return;

    const current =
      fieldWeather[String(synthesisField.id)];

    if (
      current?.status === 'ready' ||
      current?.status === 'loading'
    ) {
      return;
    }

    void loadFieldWeather(synthesisField);
  }, [
    synthesisField?.id,
    fieldWeather,
    loadFieldWeather,
  ]);

  const synthesisWeatherContext = useMemo(() => {
    if (!synthesisField || !synthesisWeather) return null;

    return {
      fieldId: String(synthesisField.id),
      locationLabel: synthesisWeather.locationLabel ?? null,
      status: synthesisWeather.status,
      forecast: Array.isArray(synthesisWeather.forecast)
        ? synthesisWeather.forecast.slice(0, 5)
        : [],
      providers: Array.isArray(synthesisWeather.providers)
        ? synthesisWeather.providers.slice(0, 3).map((provider: any) => ({
            name: provider?.name ?? null,
            forecast: Array.isArray(provider?.forecast)
              ? provider.forecast.slice(0, 5)
              : [],
          }))
        : [],
      message: synthesisWeather.message ?? null,
    };
  }, [
    synthesisField?.id,
    synthesisWeather,
  ]);

  const synthesisClimateContext = useMemo(() => {
    const context: any = unifiedClimateContext;
    if (!context || !synthesisField) return null;

    return String(context.fieldId ?? '') === String(synthesisField.id)
      ? context
      : null;
  }, [
    unifiedClimateContext,
    synthesisField?.id,
  ]);
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<FieldSynthesisResult | null>(null);
  const [synthesisError, setSynthesisError] = useState('');
  const [loadingDots, setLoadingDots] = useState('.');
  const synthesisRequestRef = useRef(0);

  useEffect(() => {
    if (!synthesisLoading) {
      setLoadingDots('.');
      return;
    }
    const timer = window.setInterval(() => {
      setLoadingDots((current) => current === '.' ? '..' : current === '..' ? '...' : '.');
    }, 420);
    return () => window.clearInterval(timer);
  }, [synthesisLoading]);

  const runSynthesis = async () => {
    if (!synthesisField?.id) return;
    const requestId = ++synthesisRequestRef.current;
    setSynthesisLoading(true);
    setSynthesisError('');
    try {
      const result = await synthesizeFieldObservations({
        fieldId: String(synthesisField.id),
        fieldName: synthesisField.name,
        crop: synthesisField.crop,
        weatherContext: synthesisWeatherContext,
        climateContext: synthesisClimateContext,
      });
      if (requestId !== synthesisRequestRef.current) return;
      setSynthesisResult(result);
    } catch (error) {
      if (requestId !== synthesisRequestRef.current) return;
      setSynthesisResult(null);
      setSynthesisError(
        error instanceof Error ? error.message : 'Pusula genel değerlendirmeyi oluşturamadı.',
      );
    } finally {
      if (requestId === synthesisRequestRef.current) setSynthesisLoading(false);
    }
  };

  useEffect(() => {
    if (!synthesisField?.id) {
      setSynthesisResult(null);
      setSynthesisError('');
      return;
    }
    const timer = window.setTimeout(() => void runSynthesis(), 320);
    return () => window.clearTimeout(timer);
  }, [
    synthesisField?.id,
    synthesisWeather?.status,
    synthesisWeather?.forecast?.length,
  ]);

  const synthesisInsight = useMemo<PusulaInsight | null>(() => {
    if (!synthesisField) return null;

    if (synthesisLoading) {
      return {
        id: `field-synthesis-loading:${String(synthesisField.id)}:${synthesisRequestRef.current}`,
        gozlem:
          'Tarla verilerini, son harita gözlemlerini ve hava durumunu bir araya getiriyorum.',
        yonlendirme:
          'Birazdan önemli gördüğüm bölgeyi ve olası nedenleri söyleyeceğim.',
        guven_skoru: 'Orta',
      };
    }

    if (!synthesisResult) return null;

    const important = synthesisResult.importantArea;

    const evidenceText = (synthesisResult.evidence ?? [])
      .slice(0, 4)
      .map((item) => `${item.layerLabel}: ${item.finding}`)
      .join(' ');

    const causeText = (synthesisResult.likelyCauses ?? [])
      .slice(0, 2)
      .map((item) => `${item.title}: ${item.reason}`)
      .join(' ');

    const dataIntro = important
      ? `${important.area} bölümünü özellikle inceledim. ${synthesisResult.summary}`
      : synthesisResult.summary;

    const gozlem = [
      dataIntro,
      evidenceText ? `Kullandığım verilerden öne çıkanlar: ${evidenceText}` : '',
      causeText ? `Bunlara göre öne çıkan ihtimaller: ${causeText}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      id: `field-synthesis:${String(synthesisField.id)}:${synthesisResult.memoryObservationId ?? synthesisResult.generatedAt}`,
      gozlem,
      yonlendirme: synthesisResult.action,
      guven_skoru: confidenceToTurkish(synthesisResult.confidence),
    };
  }, [
    synthesisLoading,
    synthesisResult,
    synthesisField?.id,
  ]);

  return (
    <>
      <style>{cmsRuntimeCss + onboardingStyles + PUSULA_AI_EXTRA_STYLES}</style>

      <PusulaGuide insight={synthesisInsight} anchorSelector=".tp-pusula-synthesis-anchor" />

      <div className="tp-ai-page">
        <header className="tp-ai-page-header">
          <button onClick={() => setScreen('home')}>←</button>

          <div>
            <span>TarlaPusula AI</span>
            <strong>
              {cmsText(
                aiHeaderBlock,
                aiPage?.title || 'Fotoğraftan Ön Analiz',
              )}
            </strong>
          </div>

          <div
            className="tp-ai-page-spark"
            style={{ fontSize: aiHeaderBlock?.icon_size || undefined }}
          >
            {aiHeaderBlock?.icon || aiPage?.icon || '✦'}
          </div>
        </header>

        <main className="tp-ai-page-content">
          <section className="tp-pusula-synthesis">
            <div className="tp-pusula-synthesis-head">
              <div className="tp-pusula-synthesis-copy">
                <span className="tp-pusula-synthesis-kicker">✦ PUSULA GENEL DEĞERLENDİRMESİ</span>
                <h2>{synthesisField ? synthesisField.name : 'Tarlanı seç'}</h2>
                <p>Pusula’dan Sana kayıtlarını birlikte okuyup aynı bölgede çakışan işaretleri karşılaştırıyorum.</p>

                {synthesisWeather?.status === 'ready' && (
                  <p style={{ marginTop: 5 }}>
                    5 günlük hava tahmini de genel değerlendirmeye dahil.
                  </p>
                )}
              </div>

              <button
                type="button"
                className={`tp-pusula-synthesis-anchor${synthesisLoading ? ' loading' : ''}`}
                onClick={() => void runSynthesis()}
                disabled={synthesisLoading || !synthesisField}
                aria-label="Pusula genel değerlendirmesini yenile"
              >
                <img src={PUSULA_BODY_SRC} alt="" draggable={false} />
              </button>
            </div>

            {!synthesisField && (
              <div className="tp-pusula-synthesis-empty">
                <strong>Önce bir tarla eklemelisin.</strong>
                <p>Pusula genel değerlendirme yapabilmek için bir tarlanın kayıtlarına ihtiyaç duyar.</p>
              </div>
            )}

            {synthesisLoading && (
              <div className="tp-pusula-synthesis-progress">
                <strong>Pusula verileri harmanlıyor ve sonucu hazırlıyor{loadingDots}</strong>
                <span>Sağlık, radar, toprak ve iklim kayıtlarındaki son gözlemler karşılaştırılıyor.</span>
              </div>
            )}

            {!!synthesisError && !synthesisLoading && (
              <div className="tp-pusula-synthesis-error">{synthesisError}</div>
            )}

            {synthesisResult && !synthesisLoading && (
              <div className="tp-pusula-synthesis-result">
                <div className="tp-pusula-synthesis-status">
                  <div>
                    <span>PUSULA'NIN SONUCU</span>
                    <strong>{synthesisResult.headline}</strong>
                  </div>
                  <div className={`tp-pusula-status-pill ${synthesisResult.status}`}>
                    {synthesisResult.status === 'normal'
                      ? 'NORMAL'
                      : synthesisResult.status === 'dikkat'
                        ? 'DİKKAT'
                        : 'KONTROL'}
                  </div>
                </div>

                <p className="tp-pusula-main-summary">{synthesisResult.summary}</p>

                {synthesisResult.importantArea && (
                  <div className="tp-pusula-important-area">
                    <span>PUSULA'NIN ÖNEMLİ GÖRDÜĞÜ BÖLGE</span>
                    <strong>{synthesisResult.importantArea.area}</strong>
                    <p>{synthesisResult.importantArea.summary}</p>
                  </div>
                )}

                {synthesisResult.likelyCauses.length > 0 && (
                  <div className="tp-pusula-section">
                    <span className="tp-pusula-section-title">NE OLABİLİR?</span>
                    <div className="tp-pusula-causes">
                      {synthesisResult.likelyCauses.map((item, index) => (
                        <article className="tp-pusula-cause" key={`pusula-cause-${index}`}>
                          <strong>{item.title}</strong>
                          <p>{item.reason}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {synthesisResult.evidence.length > 0 && (
                  <div className="tp-pusula-section">
                    <span className="tp-pusula-section-title">BUNU NEDEN SÖYLÜYORUM?</span>
                    <div className="tp-pusula-evidence">
                      {synthesisResult.evidence.map((item, index) => (
                        <div className="tp-pusula-evidence-row" key={`pusula-evidence-${index}`}>
                          <strong>{item.layerLabel}</strong>
                          <span>{item.finding}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {synthesisResult.evidence.length > 0 && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: '13px 14px',
                      borderRadius: 15,
                      border: '1px solid rgba(205,178,109,.14)',
                      background: 'rgba(255,255,255,.025)',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        marginBottom: 8,
                        color: '#cdb26d',
                        fontSize: 9,
                        fontWeight: 900,
                        letterSpacing: '.1em',
                      }}
                    >
                      PUSULA'NIN KULLANDIĞI VERİLER
                    </span>

                    {synthesisResult.evidence.slice(0, 6).map((item, index) => (
                      <p
                        key={`pusula-data-${index}`}
                        style={{
                          margin: index === 0 ? 0 : '7px 0 0',
                          color: '#aeb9b0',
                          fontSize: 11,
                          lineHeight: 1.5,
                        }}
                      >
                        <strong style={{ color: '#e7d9b5' }}>
                          {item.layerLabel}:
                        </strong>{' '}
                        {item.finding}
                      </p>
                    ))}
                  </div>
                )}

                <div className="tp-pusula-action">
                  <span>NE YAPMALISIN?</span>
                  <p>{synthesisResult.action}</p>
                </div>

                <div className="tp-pusula-synthesis-footer">
                  <span>{synthesisResult.layerCount} güncel harita kaydı harmanlandı</span>
                  <button
                    type="button"
                    className="tp-pusula-refresh"
                    onClick={() => void runSynthesis()}
                    disabled={synthesisLoading}
                  >
                    ↻ Yeniden Harmanla
                  </button>
                </div>

                <div className="tp-pusula-caution">{synthesisResult.caution}</div>
              </div>
            )}
          </section>

          <section className="tp-ai-hero">
            <div className="tp-ai-hero-icon">✦</div>

            <div>
              <span>{aiHeroBlock?.icon || 'AI TARLA ASİSTANI'}</span>
              <h1>
                {cmsText(
                  aiHeroBlock,
                  'Fotoğrafı çek, tarladaki belirtiyi birlikte inceleyelim.',
                )}
              </h1>
              <p>
                {cmsSub(
                  aiHeroBlock,
                  'Yaprak, meyve veya sorunlu bölgenin net bir fotoğrafını yükle. Sonuç kesin teşhis değil, hızlı bir saha ön değerlendirmesidir.',
                )}
              </p>
            </div>
          </section>

          <section className="tp-ai-access-card">
            <div className="tp-ai-access-copy">
              <span>{cmsText(aiAccessBlock, 'KULLANIM HAKKI')}</span>

              {aiAccessLoading ? (
                <strong>Kontrol ediliyor...</strong>
              ) : aiAccessStatus?.unlimited ? (
                <>
                  <strong>Pro • Sınırsız AI Analiz</strong>
                  <small>Ücretli aboneliğinde günlük sınır yok.</small>
                </>
              ) : (
                <>
                  <strong>
                    Bugün {aiAccessStatus?.freeRemaining ?? 0} ücretsiz analiz
                    hakkın var
                  </strong>
                  <small>
                    Ücretsiz planda her gün 1 analiz. Ek haklar ileride ödüllü
                    reklam izleyerek kazanılabilecek.
                  </small>
                </>
              )}
            </div>

            {!aiAccessStatus?.unlimited && (
              <div className="tp-ai-access-badges">
                <span>Günlük: {aiAccessStatus?.freeRemaining ?? 0}/1</span>
                <span>Ek hak: {aiAccessStatus?.rewardCredits ?? 0}</span>
              </div>
            )}
          </section>

          <section className="tp-ai-workspace">
            <div className="tp-ai-workspace-head">
              <div>
                <span>{aiFieldStepBlock?.icon || '1. TARLAYI SEÇ'}</span>
                <strong>
                  {cmsText(aiFieldStepBlock, 'Analizin hangi tarlaya ait?')}
                </strong>
              </div>
            </div>

            {realFields.length > 0 ? (
              <MobileWheelPicker
                className="tp-ai-field-select"
                title="Analiz edilecek tarla"
                value={selectedField ? String(selectedField.id) : ''}
                placeholder="Tarla seç"
                searchable
                options={realFields.map((field) => ({
                  value: String(field.id),
                  label: field.name,
                  subtitle: `${field.crop} • ${field.area.toLocaleString('tr-TR')} da`,
                }))}
                onChange={(value) => {
                  const field = realFields.find(
                    (item) => String(item.id) === value,
                  );
                  setSelectedField(field ?? null);
                  clearActivityPhoto();
                }}
              />
            ) : (
              <div className="tp-ai-empty-field">
                <strong>Önce bir tarla eklemelisin.</strong>
                <button onClick={openAddField}>+ Tarla Ekle</button>
              </div>
            )}

            <div className="tp-ai-workspace-head tp-ai-step-two">
              <div>
                <span>{aiPhotoStepBlock?.icon || '2. FOTOĞRAF'}</span>
                <strong>
                  {cmsText(
                    aiPhotoStepBlock,
                    'Belirtiyi net gösteren bir görüntü ekle',
                  )}
                </strong>
              </div>
            </div>

            {activityPhotoPreview ? (
              <div className="tp-ai-main-photo">
                <img src={activityPhotoPreview} alt="AI analiz fotoğrafı" />

                <div>
                  <strong>Fotoğraf hazır</strong>
                  <small>
                    Yakın çekim ve iyi ışık analiz kalitesini artırır.
                  </small>

                  <label>
                    Fotoğrafı Değiştir
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) =>
                        void handleActivityPhotoChange(e.target.files?.[0])
                      }
                    />
                  </label>

                  <button type="button" onClick={clearActivityPhoto}>
                    Fotoğrafı Kaldır
                  </button>
                </div>
              </div>
            ) : (
              <label className="tp-ai-main-picker">
                <div>📷</div>
                <strong>
                  {cmsText(aiPickerBlock, 'Fotoğraf Çek / Galeriden Seç')}
                </strong>
                <span>
                  {cmsSub(
                    aiPickerBlock,
                    'Yaprak, meyve, gövde veya sorunlu bölgeyi mümkün olduğunca net göster.',
                  )}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) =>
                    void handleActivityPhotoChange(e.target.files?.[0])
                  }
                />
              </label>
            )}

            <label className="tp-ai-note-field">
              {cmsText(aiNoteBlock, 'Gözlemin (isteğe bağlı)')}
              <textarea
                value={activityNotes}
                onChange={(e) => setActivityNotes(e.target.value)}
                placeholder="Örn: Yapraklardaki lekeler 3 gündür artıyor..."
              />
            </label>

            {!aiAccessStatus?.unlimited && !canAnalyze && (
              <div className="tp-ai-limit-box">
                <div>
                  <span>🔒</span>
                  <div>
                    <strong>Bugünkü ücretsiz hakkını kullandın</strong>
                    <p>Yarın tekrar 1 ücretsiz analiz hakkın olacak.</p>
                  </div>
                </div>

                <button type="button" disabled>
                  ▶ Reklam İzle • +1 Hak
                  <small>Yakında</small>
                </button>
              </div>
            )}

            <button
              className="tp-ai-main-analyze"
              type="button"
              onClick={() => void handleAiAnalyzeActivityPhoto()}
              disabled={
                aiAnalyzing ||
                !selectedField ||
                !activityPhoto ||
                (!canAnalyze && aiAccessStatus !== null)
              }
            >
              <span>{aiAnalyzing ? '◌' : '✦'}</span>
              {aiAnalyzing
                ? 'Gemini fotoğrafı inceliyor...'
                : cmsText(aiAnalyzeBlock, 'AI ile Analiz Et')}
            </button>

            {aiAnalysisError && (
              <div className="tp-ai-error tp-ai-page-error">
                {aiAnalysisError}
              </div>
            )}

            {aiAnalysis && (
              <div
                className={`tp-ai-result tp-ai-page-result tp-ai-${aiAnalysis.status}`}
              >
                <div className="tp-ai-result-head">
                  <div>
                    <span>AI ÖN DEĞERLENDİRME</span>
                    <strong>{aiAnalysis.headline}</strong>
                  </div>

                  <div className="tp-ai-confidence">
                    %{aiAnalysis.confidence}
                    <small>güven</small>
                  </div>
                </div>

                <div className="tp-ai-possible">
                  <span>Olası durum</span>
                  <strong>{aiAnalysis.possibleIssue}</strong>
                </div>

                {aiAnalysis.observations.length > 0 && (
                  <div className="tp-ai-list">
                    <span>Fotoğrafta görülenler</span>
                    {aiAnalysis.observations.map((item, index) => (
                      <p key={`main-ai-obs-${index}`}>• {item}</p>
                    ))}
                  </div>
                )}

                {aiAnalysis.recommendations.length > 0 && (
                  <div className="tp-ai-list">
                    <span>Önerilen sonraki adım</span>
                    {aiAnalysis.recommendations.map((item, index) => (
                      <p key={`main-ai-rec-${index}`}>• {item}</p>
                    ))}
                  </div>
                )}

                <div className="tp-ai-disclaimer">{aiAnalysis.disclaimer}</div>

                <button
                  type="button"
                  className="tp-ai-save-history"
                  disabled={activityFormLoading}
                  onClick={() => void handleAddActivity()}
                >
                  {activityFormLoading
                    ? 'Kaydediliyor...'
                    : '📒 Tarla Geçmişine Kaydet'}
                </button>
              </div>
            )}
          </section>
        </main>

        <nav className="bottomNav tp-ai-bottom-nav">
          <button onClick={() => setScreen('home')}>
            <span>⌂</span>
            Ana Sayfa
          </button>

          <button
            onClick={() => {
              setScreen('home');
              setTimeout(() => {
                document
                  .querySelector('.fieldsSection')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 60);
            }}
          >
            <span>🌾</span>
            Tarlalarım
          </button>

          <button className="addButton active tp-ai-nav-main">
            <span>✦</span>
            AI Analiz
          </button>

          <button onClick={openCalendarScreen}>
            <span>▣</span>
            Takvim
          </button>

          <button>
            <span>•••</span>
            Daha Fazla
          </button>
        </nav>
      </div>
    </>
  );
}