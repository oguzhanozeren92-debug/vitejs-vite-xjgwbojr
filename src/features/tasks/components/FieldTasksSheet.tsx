import { CheckCircle2, ChevronRight, ClipboardCheck, Loader2, X } from 'lucide-react';
import type { FieldTask } from '../services/fieldTasks.service';

const CSS = String.raw`
.tp-tasks-backdrop{position:fixed;z-index:880;inset:0;border:0;background:rgba(0,0,0,.56);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
.tp-tasks-sheet{position:fixed;z-index:881;left:50%;bottom:0;width:min(100%,560px);max-height:min(76dvh,690px);transform:translateX(-50%);display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(91,132,101,.28);border-bottom:0;border-radius:22px 22px 0 0;background:linear-gradient(180deg,rgba(7,22,11,.985),rgba(2,9,5,.995));box-shadow:0 -22px 60px rgba(0,0,0,.48);color:#eaf5ec;padding-bottom:max(10px,env(safe-area-inset-bottom))}
.tp-tasks-handle{width:42px;height:4px;margin:8px auto 3px;border-radius:999px;background:rgba(220,239,225,.18)}
.tp-tasks-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px 11px;border-bottom:1px solid rgba(112,151,121,.13)}
.tp-tasks-head-copy{min-width:0}.tp-tasks-kicker{display:flex;align-items:center;gap:5px;color:#67c47e;font-size:7px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.tp-tasks-head h2{margin:4px 0 0;color:#edf7ef;font-size:19px;line-height:1.1}.tp-tasks-head p{margin:5px 0 0;color:rgba(209,229,214,.52);font-size:9px;line-height:1.4}.tp-tasks-close{flex:0 0 36px;width:36px;height:36px;display:grid;place-items:center;border:1px solid rgba(126,158,134,.18);border-radius:11px;background:rgba(255,255,255,.025);color:#d8e8dc;cursor:pointer}.tp-tasks-body{overflow:auto;padding:10px 12px 16px;overscroll-behavior:contain}.tp-task-list{display:grid;gap:8px}.tp-task-card{width:100%;display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border:1px solid rgba(104,141,113,.15);border-radius:14px;background:rgba(255,255,255,.025);color:inherit;text-align:left}.tp-task-card.is-current{border-color:rgba(34,197,94,.30);background:linear-gradient(135deg,rgba(34,197,94,.08),rgba(255,255,255,.018));box-shadow:inset 0 0 22px rgba(34,197,94,.025)}.tp-task-icon{width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(83,143,98,.23);border-radius:12px;background:rgba(16,62,29,.42);color:#86efac}.tp-task-copy{min-width:0}.tp-task-title-row{display:flex;align-items:center;gap:6px}.tp-task-copy strong{min-width:0;overflow:hidden;color:#edf7ef;font-size:11px;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}.tp-task-points{flex:0 0 auto;color:rgba(134,239,172,.65);font-size:7px;font-weight:850;letter-spacing:.02em}.tp-task-copy p{margin:4px 0 0;color:rgba(207,225,212,.53);font-size:8.5px;line-height:1.4}.tp-task-action{min-width:55px;min-height:30px;padding:0 8px;border:1px solid rgba(34,197,94,.25);border-radius:9px;background:rgba(34,197,94,.09);color:#c9f3d3;font:inherit;font-size:8px;font-weight:850;cursor:pointer}.tp-task-action:disabled{cursor:default;border-color:rgba(149,166,154,.10);background:rgba(255,255,255,.02);color:rgba(197,211,201,.35)}.tp-tasks-state{min-height:180px;display:grid;place-items:center;padding:25px;text-align:center}.tp-tasks-state svg{color:#72c987}.tp-tasks-state strong{display:block;margin-top:9px;color:#e6f2e9;font-size:13px}.tp-tasks-state p{margin:5px 0 0;color:rgba(205,222,209,.48);font-size:9px;line-height:1.45}.tp-tasks-error{margin:0 0 8px;padding:9px 10px;border:1px solid rgba(239,68,68,.18);border-radius:11px;background:rgba(239,68,68,.05);color:#fca5a5;font-size:8.5px;line-height:1.4}
`;

type Props = {
  open: boolean;
  fieldName: string;
  tasks: FieldTask[];
  loading?: boolean;
  error?: string | null;
  currentTaskKey?: string | null;
  onClose: () => void;
  onStartTask: (task: FieldTask) => void;
};

export default function FieldTasksSheet({
  open,
  fieldName,
  tasks,
  loading = false,
  error = null,
  currentTaskKey = null,
  onClose,
  onStartTask,
}: Props) {
  if (!open) return null;

  return (
    <>
      <style>{CSS}</style>
      <button
        type="button"
        className="tp-tasks-backdrop"
        aria-label="Görevlerimi kapat"
        onClick={onClose}
      />
      <section className="tp-tasks-sheet" role="dialog" aria-modal="true" aria-label="Görevlerim">
        <div className="tp-tasks-handle" aria-hidden="true" />
        <header className="tp-tasks-head">
          <div className="tp-tasks-head-copy">
            <span className="tp-tasks-kicker"><ClipboardCheck size={13} /> Görevlerim</span>
            <h2>{fieldName}</h2>
            <p>Eksik veriyi tamamla; Pusula'nın yorumları güçlensin.</p>
          </div>
          <button type="button" className="tp-tasks-close" onClick={onClose} aria-label="Kapat">
            <X size={18} />
          </button>
        </header>

        <div className="tp-tasks-body">
          {error ? <p className="tp-tasks-error">{error}</p> : null}

          {loading && !tasks.length ? (
            <div className="tp-tasks-state">
              <div>
                <Loader2 size={26} className="tp-spin" />
                <strong>Görevler kontrol ediliyor</strong>
              </div>
            </div>
          ) : tasks.length ? (
            <div className="tp-task-list">
              {tasks.map((task, index) => {
                const isCurrent = task.taskKey === currentTaskKey || (!currentTaskKey && index === 0);
                return (
                  <article key={task.id} className={`tp-task-card ${isCurrent ? 'is-current' : ''}`}>
                    <span className="tp-task-icon"><ClipboardCheck size={18} strokeWidth={1.8} /></span>
                    <div className="tp-task-copy">
                      <div className="tp-task-title-row">
                        <strong>{task.title}</strong>
                        {task.rewardPoints > 0 ? <span className="tp-task-points">+{task.rewardPoints}P</span> : null}
                      </div>
                      {task.description ? <p>{task.description}</p> : null}
                    </div>
                    <button
                      type="button"
                      className="tp-task-action"
                      disabled={!isCurrent}
                      onClick={() => onStartTask(task)}
                    >
                      {isCurrent ? <>Başla <ChevronRight size={11} /></> : 'Sırada'}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="tp-tasks-state">
              <div>
                <CheckCircle2 size={30} />
                <strong>Şimdilik görev yok</strong>
                <p>Yeni bir eksik veri veya saha işi oluşursa burada görünecek.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
