import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import FieldTasksSheet from './FieldTasksSheet';
import { useFieldTasks } from '../hooks/useFieldTasks';
import type { FieldTask } from '../services/fieldTasks.service';
import {
  saveFieldCanopyDevelopmentClass,
  saveFieldCanopyHeightClass,
  saveFieldIrrigationStatus,
} from '../../fields/services/fieldCompletion.service';
import {
  CANOPY_DEVELOPMENT_OPTIONS,
  CANOPY_HEIGHT_OPTIONS,
} from '../../fields/data/canopyDevelopmentProfiles';
import { openFieldOperation } from '../../field-operations/services/openFieldOperation';
import { openFieldSeason } from '../../field-detail/services/openFieldSeason';

const CSS = String.raw`
/* Eski bağımsız fullscreen düğmesi artık Görevlerim girişidir. */
.tp-map-fullscreen-btn{position:relative!important}
.tp-map-fullscreen-btn>svg{display:none!important}
.tp-map-fullscreen-btn::before{content:'☑';display:block;color:rgba(226,241,230,.90);font:700 21px/1 system-ui,sans-serif;transform:translateY(-1px)}
.tp-map-fullscreen-btn[data-task-count]:not([data-task-count='0'])::after{content:attr(data-task-count);position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;display:grid;place-items:center;padding:0 3px;border:2px solid #061308;border-radius:999px;background:#22c55e;color:#041007;font:900 7px/1 system-ui,sans-serif;box-sizing:border-box}

/* Eksik veri artık dağınık Pusula popup'ı olarak çıkmaz; Görevlerim'de yaşar. */
.tp-pusula-question{display:none!important}

.tp-task-answer-backdrop{position:fixed;z-index:890;inset:0;border:0;background:rgba(0,0,0,.62);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.tp-task-answer{position:fixed;z-index:891;left:50%;top:50%;width:min(calc(100vw - 24px),470px);max-height:min(78dvh,650px);transform:translate(-50%,-50%);overflow:auto;border:1px solid rgba(78,145,94,.30);border-radius:20px;background:linear-gradient(160deg,rgba(7,24,12,.99),rgba(2,9,5,.995));box-shadow:0 24px 70px rgba(0,0,0,.55);color:#eaf6ed;padding:15px;box-sizing:border-box}
.tp-task-answer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.tp-task-answer-head small{display:block;color:#67c47e;font-size:7px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.tp-task-answer-head h3{margin:5px 0 0;color:#eef8f0;font-size:17px;line-height:1.2}.tp-task-answer-head p{margin:6px 0 0;color:rgba(211,229,216,.56);font-size:9px;line-height:1.45}.tp-task-answer-close{flex:0 0 34px;width:34px;height:34px;display:grid;place-items:center;border:1px solid rgba(121,155,129,.18);border-radius:10px;background:rgba(255,255,255,.025);color:#dbe9de;cursor:pointer}.tp-task-answer-options{display:grid;gap:7px;margin-top:14px}.tp-task-answer-option{width:100%;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 11px;border:1px solid rgba(88,140,100,.20);border-radius:12px;background:rgba(255,255,255,.025);color:#e1f1e5;text-align:left;font:inherit;font-size:10px;font-weight:800;cursor:pointer}.tp-task-answer-option:hover:not(:disabled){border-color:rgba(34,197,94,.38);background:rgba(34,197,94,.075)}.tp-task-answer-option:disabled{opacity:.55;cursor:wait}.tp-task-answer-reward{color:rgba(134,239,172,.62);font-size:7px;font-weight:850}.tp-task-answer-error{margin:10px 0 0;padding:8px 9px;border:1px solid rgba(239,68,68,.20);border-radius:10px;background:rgba(239,68,68,.06);color:#fca5a5;font-size:8.5px;line-height:1.4}.tp-task-award{position:fixed;z-index:920;left:50%;top:max(74px,calc(env(safe-area-inset-top) + 54px));transform:translateX(-50%);display:flex;align-items:center;gap:7px;min-height:36px;padding:0 12px;border:1px solid rgba(34,197,94,.30);border-radius:999px;background:rgba(3,17,8,.96);box-shadow:0 10px 30px rgba(0,0,0,.34),0 0 24px rgba(34,197,94,.08);color:#dff7e5;font-size:9px;font-weight:850}.tp-task-award b{color:#86efac;font-size:11px}
`;

type TaskOption = { value: string; label: string };

function taskOptions(task: FieldTask | null): TaskOption[] {
  if (!task) return [];

  if (task.taskKey === 'irrigation-status') {
    return [
      { value: 'sulu', label: 'Sulu' },
      { value: 'susuz', label: 'Susuz' },
      { value: 'kısmi', label: 'Kısmi / ihtiyaca göre' },
    ];
  }

  if (task.taskKey === 'canopy-development') {
    return CANOPY_DEVELOPMENT_OPTIONS.map((item) => ({
      value: item.value,
      label: item.label,
    }));
  }

  if (task.taskKey === 'canopy-height') {
    return CANOPY_HEIGHT_OPTIONS.map((item) => ({
      value: item.value,
      label: item.label,
    }));
  }

  return [];
}

export default function TaskOverlayHost() {
  const [fieldId, setFieldId] = useState('');
  const [fieldName, setFieldName] = useState('Tarlan');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<FieldTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [awardNotice, setAwardNotice] = useState<number | null>(null);

  const { tasks, activeCount, loading, error, refresh, complete } = useFieldTasks(fieldId);
  const options = useMemo(() => taskOptions(selectedTask), [selectedTask]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let observedSelect: HTMLSelectElement | null = null;

    const syncDom = () => {
      const select = document.querySelector('.tp-field-select') as HTMLSelectElement | null;
      if (select) {
        const nextId = String(select.value ?? '').trim();
        const nextName = select.selectedOptions?.[0]?.textContent?.trim() || 'Tarlan';
        setFieldId((current) => (current === nextId ? current : nextId));
        setFieldName((current) => (current === nextName ? current : nextName));

        if (observedSelect !== select) {
          observedSelect?.removeEventListener('change', syncDom);
          observedSelect = select;
          observedSelect.addEventListener('change', syncDom);
        }
      }

      const taskButton = document.querySelector('.tp-map-fullscreen-btn') as HTMLButtonElement | null;
      if (taskButton) {
        taskButton.setAttribute('aria-label', 'Görevlerim');
        taskButton.setAttribute('title', 'Görevlerim');
        taskButton.dataset.taskCount = String(activeCount);
      }
    };

    syncDom();
    const observer = new MutationObserver(syncDom);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      observedSelect?.removeEventListener('change', syncDom);
    };
  }, [activeCount]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const interceptTaskButton = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest?.('.tp-map-fullscreen-btn');
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const select = document.querySelector('.tp-field-select') as HTMLSelectElement | null;
      const nextId = String(select?.value ?? fieldId ?? '').trim();
      const nextName = select?.selectedOptions?.[0]?.textContent?.trim() || fieldName || 'Tarlan';
      setFieldId(nextId);
      setFieldName(nextName);
      setSelectedTask(null);
      setAnswerError(null);
      setSheetOpen(true);
      if (nextId) window.setTimeout(() => void refresh(), 0);
    };

    document.addEventListener('click', interceptTaskButton, true);
    return () => document.removeEventListener('click', interceptTaskButton, true);
  }, [fieldId, fieldName, refresh]);

  useEffect(() => {
    if (awardNotice == null) return;
    const timer = window.setTimeout(() => setAwardNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [awardNotice]);

  const startTask = (task: FieldTask) => {
    setAnswerError(null);
    setSheetOpen(false);

    if (task.taskKey === 'model-last-irrigation') {
      setSelectedTask(null);
      openFieldOperation({
        fieldId: task.fieldId || fieldId,
        fieldName,
        type: 'Sulama',
        source: 'model-readiness-task',
      });
      return;
    }

    if (task.taskKey === 'model-planting-date') {
      setSelectedTask(null);
      openFieldSeason({
        fieldId: task.fieldId || fieldId,
        source: 'model-readiness-task',
      });
      return;
    }

    setSelectedTask(task);
  };

  const saveTaskAnswer = async (value: string) => {
    if (!selectedTask || !fieldId || saving) return;
    setSaving(true);
    setAnswerError(null);

    try {
      if (selectedTask.taskKey === 'irrigation-status') {
        if (value !== 'sulu' && value !== 'susuz' && value !== 'kısmi') {
          throw new Error('Geçerli bir sulama durumu seç.');
        }
        await saveFieldIrrigationStatus({ fieldId, irrigationStatus: value });
      } else if (selectedTask.taskKey === 'canopy-development') {
        await saveFieldCanopyDevelopmentClass({
          fieldId,
          canopyDevelopmentClass: value as 'very_small' | 'small' | 'medium' | 'large' | 'very_large',
        });
      } else if (selectedTask.taskKey === 'canopy-height') {
        await saveFieldCanopyHeightClass({
          fieldId,
          canopyHeightClass: value as 'under_1m' | '1_2m' | '2_3m' | '3_5m' | 'over_5m',
        });
      } else {
        throw new Error('Bu görev için veri giriş akışı henüz bağlı değil.');
      }

      const result = await complete(selectedTask.id);
      if (!result.completed) {
        throw new Error('Görev verisi kaydedildi ancak sunucu tamamlandığını doğrulayamadı.');
      }

      setSelectedTask(null);
      setSheetOpen(true);
      if (result.awarded && result.awardedPoints > 0) {
        setAwardNotice(result.awardedPoints);
      }
      await refresh();
    } catch (caught) {
      setAnswerError(caught instanceof Error ? caught.message : 'Görev tamamlanamadı.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>

      <FieldTasksSheet
        open={sheetOpen && !selectedTask}
        fieldName={fieldName}
        tasks={tasks}
        loading={loading}
        error={error}
        currentTaskKey={tasks[0]?.taskKey ?? null}
        onClose={() => setSheetOpen(false)}
        onStartTask={startTask}
      />

      {selectedTask ? (
        <>
          <button
            type="button"
            className="tp-task-answer-backdrop"
            aria-label="Görev girişini kapat"
            onClick={() => {
              if (saving) return;
              setSelectedTask(null);
              setSheetOpen(true);
            }}
          />
          <section className="tp-task-answer" role="dialog" aria-modal="true" aria-label={selectedTask.title}>
            <header className="tp-task-answer-head">
              <div>
                <small>GÖREV · {selectedTask.rewardPoints > 0 ? `+${selectedTask.rewardPoints}P` : 'VERİ TAMAMLAMA'}</small>
                <h3>{selectedTask.title}</h3>
                {selectedTask.description ? <p>{selectedTask.description}</p> : null}
              </div>
              <button
                type="button"
                className="tp-task-answer-close"
                disabled={saving}
                onClick={() => {
                  setSelectedTask(null);
                  setSheetOpen(true);
                }}
                aria-label="Kapat"
              >
                <X size={17} />
              </button>
            </header>

            <div className="tp-task-answer-options">
              {options.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className="tp-task-answer-option"
                  disabled={saving}
                  onClick={() => void saveTaskAnswer(option.value)}
                >
                  <span>{saving ? 'Kaydediliyor…' : option.label}</span>
                  {selectedTask.rewardPoints > 0 ? (
                    <span className="tp-task-answer-reward">+{selectedTask.rewardPoints}P</span>
                  ) : null}
                </button>
              ))}
            </div>

            {answerError ? <p className="tp-task-answer-error">{answerError}</p> : null}
          </section>
        </>
      ) : null}

      {awardNotice != null ? (
        <div className="tp-task-award" role="status">
          <CheckCircle2 size={15} /> Görev tamamlandı <b>+{awardNotice}P</b>
        </div>
      ) : null}
    </>
  );
}
