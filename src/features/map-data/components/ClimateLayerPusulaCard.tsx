import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ClimateHistoryMode } from '../hooks/useClimateLayerHistory';
import { interpretClimateLayerWithPusula } from '../services/climatePusulaContext.service';
import type { UnifiedMapAiResult } from '../../../services/unifiedMapAiService';

type Props = {
  fieldId: string;
  fieldName: string;
  crop?: string;
  mode: ClimateHistoryMode;
  periodDays: number;
};

export default function ClimateLayerPusulaCard({ fieldId, fieldName, crop, mode, periodDays }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState('');
  const [analysis, setAnalysis] = useState<UnifiedMapAiResult | null>(null);

  useEffect(() => {
    setError('');
    setBlocked('');
    setAnalysis(null);
  }, [fieldId, mode, periodDays]);

  const run = async () => {
    setLoading(true);
    setError('');
    setBlocked('');
    try {
      const result = await interpretClimateLayerWithPusula({
        fieldId,
        fieldName,
        crop,
        mode,
        periodDays,
      });
      if (result.context.status === 'blocked') {
        setAnalysis(null);
        setBlocked(result.context.blockedReason || 'Bu katman Pusula yorumu için henüz hazır değil.');
        return;
      }
      setAnalysis(result.analysis);
    } catch (caught) {
      setAnalysis(null);
      setError(caught instanceof Error ? caught.message : 'Pusula iklim yorumunu oluşturamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <span style={styles.eyebrow}>PUSULA AI</span>
          <strong style={styles.title}>Bu katman ne söylüyor?</strong>
        </div>
        <button type="button" style={styles.button} onClick={() => void run()} disabled={loading}>
          {loading ? 'Yorumlanıyor…' : analysis ? 'Tekrar yorumla' : 'Pusula ile yorumla'}
        </button>
      </div>

      {!analysis && !blocked && !error ? (
        <p style={styles.idle}>Yalnız doğrulanmış gerçek kaynak verisi Pusula'ya gönderilir. Eksik veri varsa yorum üretilmez.</p>
      ) : null}
      {blocked ? <p style={styles.blocked}>{blocked}</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {analysis ? (
        <div style={styles.result}>
          <div style={styles.resultTop}>
            <strong>{analysis.headline}</strong>
            <span>{analysis.status === 'normal' ? 'Normal' : analysis.status === 'dikkat' ? 'Dikkat' : 'Kontrol'}</span>
          </div>
          <p style={styles.summary}>{analysis.summary}</p>
          {(analysis.reasons ?? []).slice(0, 3).map((reason, index) => (
            <div key={`${index}-${reason}`} style={styles.reason}>• {reason}</div>
          ))}
          <div style={styles.action}><span>NE YAPMALISIN?</span><strong>{analysis.action}</strong></div>
          <small style={styles.caution}>{analysis.caution}</small>
        </div>
      ) : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { border: '1px solid rgba(34,197,94,.24)', borderRadius: 16, background: 'rgba(6,19,8,.76)', padding: 12 },
  header: { display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { display: 'block', color: '#86efac', fontSize: 9, fontWeight: 850, letterSpacing: '.14em' },
  title: { display: 'block', marginTop: 3, color: '#edf7ef', fontSize: 14 },
  button: { minHeight: 38, borderRadius: 11, border: '1px solid rgba(34,197,94,.34)', background: 'rgba(34,197,94,.10)', color: '#d9fbe4', padding: '0 12px', fontWeight: 800, cursor: 'pointer' },
  idle: { margin: '10px 0 0', color: '#94aa9b', fontSize: 11, lineHeight: 1.45 },
  blocked: { margin: '10px 0 0', color: '#facc15', fontSize: 11, lineHeight: 1.45 },
  error: { margin: '10px 0 0', color: '#ffc6bb', fontSize: 11, lineHeight: 1.45 },
  result: { marginTop: 11, display: 'grid', gap: 8 },
  resultTop: { display: 'flex', gap: 10, justifyContent: 'space-between', color: '#f1f5f9' },
  summary: { margin: 0, color: '#b7c8bc', fontSize: 12, lineHeight: 1.5 },
  reason: { color: '#a8bcae', fontSize: 11 },
  action: { display: 'grid', gap: 3, borderTop: '1px solid #1e3a24', paddingTop: 8, color: '#eaf7ee', fontSize: 11 },
  caution: { color: '#7f9685', lineHeight: 1.4 },
};
