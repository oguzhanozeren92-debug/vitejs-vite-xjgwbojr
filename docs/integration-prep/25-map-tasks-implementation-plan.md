# 25 — Harita + Geçmiş + Görevlerim implementation planı

Bu dosya sınır kalktığında uygulanacak exact PR sırasıdır. Çalışan `main` koduna bugün değişiklik yapmaz.

# PR-1 — Harita shell temizliği

Önerilen branch:

`feat/map-fullscreen-task-entry`

## Amaç

- map tap fullscreen tek otorite
- viewport gerçekten tam dolsun
- eski Maximize butonu kalksın
- yerine Görevlerim giriş butonu gelsin
- history/tracking ikon çakışması temizlensin
- `Geçmiş` text label kalksın

## Değişecek dosyalar

### `src/features/home-map/components/HomeMapSection.tsx`

- `Maximize` importunu kaldır.
- `.tp-map-fullscreen-btn` butonunu kaldır.
- aynı toolbar slotuna `ListChecks`/`ClipboardCheck` Görevlerim butonu koy.
- Native `requestFullscreen/exitFullscreen` kodunu kaldır.
- props'a task sheet opener / task count ekle veya map-first wrapper'dan portal ile bağla; component'in task fetch yapmasına izin verme.

Önerilen prop:

```ts
activeTaskCount?: number;
onOpenTasks?: () => void;
```

### `src/features/home-map/components/HomeMapSectionMapFirst.tsx`

- `.tp-map-fullscreen-btn` click-capture toggle kodunu kaldır.
- canvas short-tap `setPortraitExpanded(true)` mekanizmasını koru.
- fullscreen CSS'i `100dvh/100dvw` + fallback ile düzelt.
- root/body scroll-lock koru.
- safe-area overlay düzeni ekle.
- task sheet portal host gerekiyorsa burada sadece UI wiring yap.

### `src/features/home-map/HomeMapEngine.tsx`

- NDVI takip noktası ikonunu `History` yerine `MapPinned`/eşdeğerine değiştir.
- uydu history `History` ikonunu koru.
- history `<span>Geçmiş</span>` kaldır.
- `aria-label` ve `title` korunur.

## Test

- iPhone portrait viewport
- Android portrait viewport
- canvas tap
- map drag
- zoom buttons
- layer button
- history button
- task button
- close/escape
- orientation resize

## Rollback

Bu PR API/schema değiştirmez. Revert ile tamamen eski UI'a dönülebilir.

---

# PR-2 — Satellite history gallery

Branch:

`feat/satellite-history-gallery`

## Amaç

Metin tarih listesi yerine gerçek önizleme galerisi ve arşiv bug fix.

## Yeni type

`src/features/map-data/types/satelliteHistory.ts`

```ts
export type SatelliteSceneSummary = {
  date: string;
  cloudCoverage: number | null;
};

export type SatelliteHistoryItem = SatelliteSceneSummary & {
  isCurrent: boolean;
  selected: boolean;
  preview: string | null;
  previewStatus: 'idle' | 'loading' | 'ready' | 'error';
};
```

## Edge Function

`supabase/functions/satellite-field-analysis/index.ts`

Backward compatibility:

Bugün:

```json
{ "success": true, "dates": [] }
```

Yeni:

```json
{
  "success": true,
  "dates": [],
  "scenes": [
    { "date": "2026-09-12", "cloudCoverage": 3.4 }
  ]
}
```

`dates` hemen kaldırılmaz.

Preview request taslağı:

```ts
{
  geometry,
  imageDate,
  previewOnly: true,
  previewSize: 256
}
```

Server `previewSize` değerini allowlist/clamp eder; client'ın keyfi dev raster istemesine izin verilmez.

## Service

`src/features/map-data/services/satelliteHistory.ts`

Yeni:

```ts
listSatelliteScenes(geometry): Promise<SatelliteSceneSummary[]>
fetchSatellitePreview(geometry, date): Promise<string>
fetchHistoricalSatellite(geometry, date): Promise<SatelliteHealthResult>
```

## Hook

`useSatelliteHistory.ts`

State:

```text
scenes
selectedDate
previewCache
fullResultCache
loadingList
loadingSelected
errorList
errorSelected
```

List error ile selected-image error ayrı tutulur.

## UI

`SatelliteHistorySheet.tsx`

- title `Uydu Geçmişi`
- current date visible
- horizontal `SatelliteHistoryCard`
- first current/latest
- previews lazy load
- selected date border
- current card resets historical override

## Data-date consistency

`MapDataDate` source:

```text
historical selection varsa -> selected result latestImageDate
aksi halde -> current satelliteData.latestImageDate
```

Aynı tarih sheet/card/map badge'de tutarlı.

## Bug verification

Before styling success sayılmaz:

- Catalog endpoint status/body log (sensitive input olmadan)
- env present check (value loglama yok)
- 30d / 180d query
- known public test geometry
- empty scene path
- cloud-filter path

## Test

`history.test.mjs` genişletilir.

Client unit test:
- dedupe dates
- first current card
- selection/reset
- preview failure doesn't kill list
- full image failure doesn't erase previous map image until safe transition

---

# PR-3 — Task Engine core

Branch:

`feat/task-engine-core`

## Yeni feature

```text
src/features/tasks/
  types/task.ts
  data/taskRewardCatalog.ts      # yalnız UI metadata; server authoritative değilse kaldır
  services/taskCandidate.service.ts
  services/taskReconciler.service.ts
  services/taskCompletion.service.ts
  services/taskSort.service.ts
  hooks/useFieldTasks.ts
  components/TaskSheet.tsx
  components/TaskRow.tsx
  components/TaskRewardBadge.tsx
  components/TaskInlineQuestion.tsx
  task.css
  __tests__/
```

## Builder'lar

```text
src/features/tasks/builders/fieldCompletionTasks.ts
src/features/tasks/builders/irrigationTasks.ts
src/features/tasks/builders/phenologyTasks.ts
src/features/tasks/builders/modelReadinessTasks.ts
src/features/tasks/builders/observationTasks.ts
src/features/tasks/builders/calendarTasks.ts
```

Builder network/DB write yapmaz; verilen domain state'ten deterministic `TaskCandidate[]` üretir.

## Task sheet wiring

`HomeMapSection` Görevlerim butonu -> `TaskSheet`.

Map component task SQL/API çağrısı yapmaz.

---

# PR-4 — Task persistence + server reward transaction

Branch:

`feat/task-rewards-backend`

## Ön koşul

Supabase implementation gününde:
1. güncel Supabase changelog kontrolü,
2. güncel Auth/RLS/Postgres guidance kontrolü,
3. migration CLI/flow güncel komutlarla oluşturulması,
4. advisors/tests.

## Taslak database işi

- `user_tasks`
- gerekirse reward catalog mevcut gamification otoritesiyle birleştirilir
- ownership RLS
- client reward/status manipulation yok
- atomic completion + reward path

## RPC taslağı

Mantıksal isim:

```text
tp_complete_task(task_id, completion_ref)
```

Kesin function ismi implementasyon sırasında mevcut DB isim standardına göre doğrulanır.

## Server checks

- authenticated user
- task owner
- active/not already rewarded
- completion condition true
- task reward rule server side
- dedupe key
- award
- complete status

## Güvenlik

- `user_metadata` authorization için kullanılmaz
- RLS ownership predicate zorunlu
- `service_role` frontend'e çıkmaz
- privileged function gerekiyorsa public callable surface ayrıca audit edilir
- raw user data logs'a yazılmaz

## Test

- other-user task cannot read/complete
- retry same completion = no duplicate reward
- completion condition false = no reward
- concurrent double click = one award
- task complete + reward atomic outcome
- field deleted task superseded

---

# PR-5 — Missing-data migration to tasks

Branch:

`feat/missing-data-tasks`

## Kaynak 1: Pusula field completion

`src/features/pusula/hooks/usePusulaFieldCompletion.ts`

Bugünkü soru seçme mantığı tamamen silinmez. İçindeki eksik veri tespit mantığı `fieldCompletionTasks` builder'a ayrılır.

Pusula UI:
- aktif task'ı isterse inline cevaplayabilir
- ancak task canonical kayıt olur
- `Şimdi değil` -> snooze

İlk taşınacaklar:
- irrigation status
- canopy development
- canopy height

## Kaynak 2: home data status

`homeFieldDataStatus.service.ts` içindeki `missing` durumları otomatik olarak task değildir.

Örnek:
- soil missing -> kullanıcı gerçekten rapor ekleyebiliyorsa task
- satellite missing -> external data yoksa kullanıcı task'ı DEĞİL
- weather missing -> API failure task DEĞİL
- irrigation `needs_data` -> eksik input kullanıcı tarafından girilebiliyorsa task

Bu ayrım test edilir.

---

# PR-6 — Notification/task semantic routing

Branch:

`refactor/action-routing`

## Hedef

Actionable content notificationQueue'ya körlemesine düşmez.

İlk refactor:
- missing-data notifications -> task
- due calendar operation -> task
- informational satellite/weather/market -> notification/Pusula
- urgent event + action -> notification CTA task'a link

Notification sistemi toptan yeniden yazılmaz.

---

# PR-7 — Pusula task intelligence

Branch:

`feat/pusula-task-context`

## Hedef

Pusula analysis context içinde:

```ts
activeTasks: {
  taskKey: string;
  title: string;
  blockingCapabilities: string[];
}[]
```

bilir.

Pusula davranışı:
- eksik veriyi her açılışta tekrar sormaz
- “Görevlerim'de 2 eksik bilgi var” diyebilir
- tamamlanan veriyi sonraki analizde kullanır
- snoozed task'ı süre bitene kadar dürtmez

---

# Exact first-task examples

## `field:<id>:irrigation-status`

Input source:
`loadFieldCompletionContext`

Condition:
`irrigationStatus === null`

Action:
existing `saveFieldIrrigationStatus`

Reward:
`TASK_FIELD_IRRIGATION_STATUS` -> initial proposal 20P

Completion event:
existing `tp:field-context-updated`

Verify:
reload context -> non-null

Then:
complete/reward/remove.

## `field:<id>:canopy-development`

Only if:
- tree/orchard crop
- bearing false
- no canopy class/percent

Action:
existing `saveFieldCanopyDevelopmentClass`

Reward proposal: 15P.

## `field:<id>:canopy-height`

Same young-orchard rules.
Reward proposal: 15P.

---

# Non-regression checklist

## Harita
- [ ] field switching
- [ ] all layers
- [ ] zoom/pan
- [ ] tracking points
- [ ] Pusula area focus
- [ ] field operation modal
- [ ] observation photo/history
- [ ] map data date
- [ ] layer sheet
- [ ] fullscreen enter/exit

## Uydu geçmişi
- [ ] current raster remains default
- [ ] history list archive independent of install date
- [ ] preview failure isolated
- [ ] selected full raster valid
- [ ] reset current
- [ ] date badge consistent

## Tasks
- [ ] no task duplicates
- [ ] task count accurate
- [ ] completion removes item
- [ ] snooze persists
- [ ] no duplicate points
- [ ] points cumulative
- [ ] existing POINT_RULES not double-awarded
- [ ] notification duplication absent
- [ ] deleted/changed field stale tasks resolve

---

# Uygulama sırası

```text
PR-1 map shell + task entry
   |
PR-2 satellite history gallery + archive bug
   |
PR-3 task engine core
   |
PR-4 persistence + reward transaction
   |
PR-5 missing-data tasks
   |
PR-6 notification routing
   |
PR-7 Pusula context
```

PR-2 ve PR-3 teknik olarak paralel olabilir; ancak aynı map UI dosyalarına aynı anda büyük değişiklik bindirmemek için yukarıdaki seri sıra tercih edilir.

# Bitti tanımı

Bu epic ancak:
- map tap truly fills app viewport,
- fullscreen icon replaced by tasks,
- satellite archive preview gallery works,
- current date visible,
- old scenes load directly,
- actionable missing data lives in tasks,
- task rewards are server-verified/idempotent,
- notifications are not task dump,
- Pusula understands active/missing-task context
olduğunda tamamlanır.
