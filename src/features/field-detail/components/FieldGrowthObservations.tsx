import { useEffect, useState, type FormEvent } from 'react';
import type { FieldSeason } from '../../../types';
import {
  addGrowthObservation, deleteGrowthObservation, listGrowthObservations,
  type GrowthObservation,
} from '../services/fieldGrowthObservations.service';
import './FieldGrowthObservations.css';

type Props = { fieldId: string; seasons: FieldSeason[] };

export default function FieldGrowthObservations({ fieldId, seasons }: Props) {
  const [items, setItems] = useState<GrowthObservation[]>([]);
  const [seasonId, setSeasonId] = useState('');
  const [observedOn, setObservedOn] = useState(new Date().toLocaleDateString('en-CA'));
  const [stage, setStage] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setItems([]);
    setError('');
    void listGrowthObservations(fieldId).then((result) => {
      if (active) setItems(result);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Gözlemler yüklenemedi.');
    });
    return () => { active = false; };
  }, [fieldId]);

  useEffect(() => {
    if (!seasons.some((season) => season.id === seasonId)) setSeasonId(seasons[0]?.id ?? '');
  }, [seasons, seasonId]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const season = seasons.find((item) => item.id === seasonId);
    if (!season || !observedOn || !stage.trim()) {
      setError('Sezon, gözlem tarihi ve bitkinin evresini yaz.'); return;
    }
    if (observedOn > new Date().toLocaleDateString('en-CA') ||
        (season.plantingDate && observedOn < season.plantingDate) ||
        (season.harvestDate && observedOn > season.harvestDate)) {
      setError('Gözlem tarihi ekim ile hasat arasında ve bugünden önce olmalı.'); return;
    }
    setBusy(true); setError('');
    try {
      await addGrowthObservation({ fieldId, seasonId, observedOn, stage, notes });
      setItems(await listGrowthObservations(fieldId));
      setStage(''); setNotes('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Gözlem kaydedilemedi.');
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Bu gelişim gözlemini silmek istiyor musun?')) return;
    setBusy(true); setError('');
    try {
      await deleteGrowthObservation(id);
      setItems(await listGrowthObservations(fieldId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Gözlem silinemedi.');
    } finally { setBusy(false); }
  };

  return <section className="tp-growth-observations" aria-label="Tarih vererek bitki gelişimi gözlemi ekle">
    <small>SAHADAN GÖZLEM</small>
    <h3>Bitki hangi evredeydi?</h3>
    <p>Gördüğün gelişimi tarihli kaydet. Bunlar senin saha gözlemlerin; model tahmini değil.</p>
    {seasons.length === 0 ? <p>Önce bu tarla için ürün ve sezon ekle.</p> : <form onSubmit={(event) => void save(event)}>
      <label>Sezon<select value={seasonId} onChange={(event) => setSeasonId(event.target.value)} required>
        {seasons.map((season) => <option key={season.id} value={season.id}>{season.year} · {season.crop}</option>)}
      </select></label>
      <label>Gördüğün tarih<input type="date" value={observedOn} max={new Date().toLocaleDateString('en-CA')} onChange={(event) => setObservedOn(event.target.value)} required /></label>
      <label>Bitkinin evresi<input value={stage} maxLength={80} minLength={2} placeholder="Örn. Çıkış, çiçeklenme, başaklanma" onChange={(event) => setStage(event.target.value)} required /></label>
      <label>Not (isteğe bağlı)<textarea value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} placeholder="Tarlada ne gördün?" /></label>
      <button type="submit" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Gözlemi kaydet'}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    {items.length > 0 && <div className="tp-growth-observations-list">
      {items.map((item) => <article key={item.id}>
        <div><strong>{item.stage}</strong><span>{item.observedOn} · {seasons.find((s) => s.id === item.seasonId)?.crop ?? 'Sezon'}</span>{item.notes && <p>{item.notes}</p>}</div>
        <button type="button" disabled={busy} onClick={() => void remove(item.id)} aria-label={`${item.stage} gözlemini sil`}>Sil</button>
      </article>)}
    </div>}
  </section>;
}
