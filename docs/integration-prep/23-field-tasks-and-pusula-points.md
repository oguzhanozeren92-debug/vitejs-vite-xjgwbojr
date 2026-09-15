# 23 — Görevlerim + eksik veri + Pusula puanı hazırlık paketi

Bu belge çalışan uygulamayı değiştirmez. Amaç `Görevlerim` sistemini sınır kalktığında doğrudan implement edilecek kadar netleştirmektir.

## Ürün kararı

`Görevlerim`, kullanıcının **bir şey yapması gereken** işlerin tek merkezi olur.

Buraya girer:
- eksik tarla verisini tamamlama,
- model/karar motoru için gerekli veri isteme,
- fotoğraf/saha gözlemi ekleme,
- sulama/operasyon kaydı ekleme,
- plan/takvimde tamamlanması gereken gerçek işler,
- kullanıcının onaylaması gereken veri veya saha kontrolü.

Buraya girmez:
- salt bilgi amaçlı hava/uydu/market haberi,
- sadece “bilgin olsun” uyarısı,
- tamamlanma kriteri olmayan Pusula önerisi.

Görev tamamlanınca:
1. gerçek işlem/veri kaydı doğrulanır,
2. görevin puanı **bir kez** verilir,
3. görev `active` listesinden kalkar,
4. backend audit kaydı kalır.

Pusula puanı **harcanabilir para değildir**. Kümülatif ilerleme/katkı puanıdır.

---

# A — Mevcut altyapıdan yararlanılacaklar

## Eksik veri kaynakları

Mevcut kodda zaten kullanılabilecek kaynaklar var:

- `src/features/fields/services/fieldCompletion.service.ts`
  - sulama durumu
  - ürün/dikim yılı
  - genç bahçe taç gelişimi
  - ağaç yüksekliği / taç örtüsü
- `src/features/pusula/hooks/usePusulaFieldCompletion.ts`
  - bugün bu eksikleri sırayla Pusula sorusuna çeviriyor
- `src/features/decision/services/homeFieldDataStatus.service.ts`
  - hava, fenoloji, uydu, toprak analizi ve sulama readiness durumunu üretiyor
- irrigation / phenology / crop-model readiness servisleri
  - modelin neden `needs_data` olduğunu biliyor veya bilecek

Yeni sistem bunları yok etmez. Bunlar `TaskCandidate` üretir.

## Puan altyapısı

`src/gamification/useGamificationStore.ts` içinde:
- server state,
- `tp_award_points` RPC,
- `dedupeKey`,
- server tarafı ödül doğrulaması,
- lifetime/cumulative puan mantığı
zaten var.

Yeni task sistemi client'tan keyfi `+20` yazmaz. Puan miktarının otoritesi server-side rule/task catalog olur.

Mevcut ödüllü eylemler (ör. `ADD_SOIL_ANALYSIS`) task içinden yapılırsa **ikinci kez ayrıca task puanı verilmez**. Görev kartı mevcut reward rule'un gerçek puanını gösterir ve aynı dedupe zincirini kullanır.

---

# B — Task domain modeli

```ts
type TaskStatus =
  | 'active'
  | 'snoozed'
  | 'completed'
  | 'superseded'
  | 'expired';

type TaskKind =
  | 'missing_data'
  | 'field_observation'
  | 'operation_record'
  | 'scheduled_operation'
  | 'verification'
  | 'setup'
  | 'model_readiness';

type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

type TaskTarget =
  | { type: 'inline_question'; questionId: string }
  | { type: 'screen'; screen: string; params?: Record<string, string> }
  | { type: 'modal'; modal: string; params?: Record<string, string> }
  | { type: 'map'; layer?: string; action?: string };

export type FieldTask = {
  id: string;
  taskKey: string;
  userId: string;
  fieldId?: string | null;
  fieldName?: string | null;
  kind: TaskKind;
  source: string;
  title: string;
  reason?: string | null;
  priority: TaskPriority;
  target: TaskTarget;
  rewardRuleKey?: string | null;
  rewardPoints: number;
  dueAt?: string | null;
  snoozedUntil?: string | null;
  status: TaskStatus;
  blockingCapabilities?: string[];
  createdAt: string;
  updatedAt: string;
};
```

`rewardPoints` kartta görüntülenen snapshot'tır. Kullanıcı/client bunu belirlemez.

---

# C — Deterministic task key

Aynı eksik veri için sürekli yeni görev üretilmeyecek.

Örnekler:

```text
field:<fieldId>:irrigation-status
field:<fieldId>:canopy-development
field:<fieldId>:canopy-height
field:<fieldId>:planting-date
field:<fieldId>:soil-analysis
field:<fieldId>:season:<seasonId>:actual-yield
field:<fieldId>:irrigation:<YYYY-MM-DD>:record-amount
field:<fieldId>:observation:<zoneId>:photo
```

Görev yeniden hesaplanırsa aynı `taskKey` upsert edilir. Böylece duplicate kart ve duplicate puan engellenir.

---

# D — Task Candidate sistemi

Her feature kendi UI'ına kart basmak yerine aday üretir:

```ts
type TaskCandidate = {
  taskKey: string;
  fieldId?: string;
  kind: TaskKind;
  source: string;
  title: string;
  reason?: string;
  priority: TaskPriority;
  target: TaskTarget;
  suggestedRewardRule: string;
  completionCheck: string;
  blockingCapabilities?: string[];
};
```

Örnek kaynaklar:

```text
fieldCompletionTaskBuilder
irrigationReadinessTaskBuilder
phenologyReadinessTaskBuilder
cropModelReadinessTaskBuilder
soilAnalysisTaskBuilder
fieldObservationTaskBuilder
calendarTaskBuilder
```

`TaskEngine` bunları birleştirir, dedupe eder, sıralar ve server task kayıtlarıyla reconcile eder.

---

# E — Eksik veri görevleri

İlk sürümde kesin adaylar:

| Görev | Neden | Önerilen ilk ödül | Completion doğrulaması |
| --- | --- | ---: | --- |
| Sulama durumunu seç | Irrigation Engine için temel bağlam | `+20P` | `fields.irrigation_status != null` |
| Dikim/ekim tarihini tamamla | fenoloji/PCSE için kritik | `+20P` | doğrulanmış season/planting date |
| Genç bahçe taç gelişimini seç | Kc/su ihtiyacı bağlamı | `+15P` | canopy class veya ölçüm var |
| Ortalama ağaç boyunu tamamla | genç bahçe bağlamı | `+15P` | height class veya metre var |
| Sulama kaydı ekle | su dengesi ground truth | `+20P` | yeni irrigation operation kaydı |
| Saha fotoğrafı ekle | zayıf bölge/teşhis kanıtı | `+20P` | yeni valid observation photo |
| Sezon ürün evresi gözlemi ekle | PCSE/fenoloji doğrulama | `+20P` | tarihli stage observation |
| Gerçek sezon verimini gir | AquaCrop/yield doğrulama | `+30P` | season actual yield var |

### Mevcut ödüllerle çakışma

Toprak analizi, depo ürünü, ürün ekleme, hastalık analizi gibi eylemlerin mevcut `POINT_RULES` ödülü varsa:
- yeni task için ikinci reward rule oluşturulmaz,
- kart mevcut rule'un puanını gösterir,
- completion mevcut reward event'ine bağlanır.

Reward catalog implementasyon öncesi tek tabloda/tek server source'ta kesinleştirilecek. Component içinde puan sabitlenmez.

---

# F — Puan ekonomisi kuralları

## 1. Puan asla client tarafından gönderilen sayıya güvenmez

Yanlış:

```ts
completeTask({ taskId, points: 5000 })
```

Doğru:

```text
taskId
 -> server task type/reward rule lookup
 -> completion evidence verify
 -> idempotent award
```

## 2. Aynı veri değiştirerek tekrar puan yok

Örnek sulama durumu:

```text
sulu -> +20P ilk completion
susuz -> 0P
tekrar sulu -> 0P
```

Dedupe:

```text
task:<taskId>
```

veya task occurrence key.

## 3. Recurring görev occurrence bazlıdır

Örneğin gerçek haftalık gözlem görevi tekrar ödüllenecekse:

```text
field:<id>:weekly-observation:2026-W38
```

Aynı hafta tekrar fotoğraf yükleyerek sınırsız puan alınmaz.

## 4. Bilgi kalitesi puandan önemlidir

Kullanıcıyı sahte veri girmeye teşvik edecek aşırı puan yok. Self-report değerleri sınırlı; gerçekten yeni/yararlı saha kanıtı daha yüksek olabilir.

## 5. Task reward UI sade

Kart sağında küçük:

```text
+20P
```

- küçük font
- düşük kontrast emerald/cyan
- ayrı büyük ödül banner'ı yok
- görevin kendisinden daha dikkat çekici değil

Completion sonrası kısa toast:

```text
Görev tamamlandı · +20 Pusula
```

Büyük konfeti varsayılan değil.

---

# G — Görev sıralaması

Reward miktarı ana sıralama kriteri değildir.

Önerilen skor:

```text
1. güvenlik / zaman kritik saha işi
2. karar motorunu bloklayan zorunlu veri
3. due date yaklaşan planlı iş
4. yüksek değerli veri tamamlama
5. isteğe bağlı setup/enrichment
```

Mantıksal score örneği:

```ts
priorityScore =
  priorityWeight
  + capabilityBlockingWeight
  + dueUrgencyWeight
  + dataValueWeight
  - snoozePenalty;
```

Puan sadece tie-break değildir bile; kullanıcı yüksek puan için agronomik önceliği bozmasın.

UI grupları ilk sürümde çok çoğaltılmaz. Tek liste + küçük kategori etiketi yeterli:
- `Öncelikli`
- `Veri eksik`
- `Saha`
- `Plan`

---

# H — Görevlerim UI

## Harita butonu

`ListChecks` veya `ClipboardCheck` ikon önerisi.

Aktif görev varsa:

```text
[✓≡]³
```

gibi küçük count badge. `+P` toolbar ikonunda gösterilmez.

## Task sheet

Mobil bottom sheet / full-height sheet:

```text
Görevlerim                         ×
3 aktif görev

[icon] Sulama durumunu tamamla          +20P
       Bademlik · Sulama önerileri için
                                            ›

[icon] Son sulamayı kaydet              +20P
       Şenpınar · Su dengesi için
                                            ›
```

Kart kuralları:
- ince border, koyu glass surface
- bir satır başlık
- en fazla 1 kısa reason satırı
- field adı küçük
- reward küçük
- warning/critical ise semantic ikon/border; her şey neon kırmızı olmaz

## Empty state

```text
Şimdilik tamam ✓
Bu tarla için bekleyen bir görev yok.
```

Puan kazanmak için yapay görev üretme yok.

---

# I — Task action akışı

Göreve basınca kullanıcı mümkün olan en kısa yerde işi tamamlar.

### Choice tipi eksik veri

Örnek sulama durumu:

```text
Task row
 -> inline mini sheet
 -> Sulu / Susuz / Kısmi
 -> saveFieldIrrigationStatus()
 -> data refresh
 -> completion verify
 -> point award
 -> task removed
```

Ayrı büyük sayfaya gönderme gerekmez.

### Daha kapsamlı veri

Toprak analizi, sezon verimi, fotoğraf:

```text
Task row
 -> ilgili mevcut modal/screen
 -> gerçek kayıt başarılı
 -> task engine completion event
 -> verify + reward
```

Task sistemi mevcut feature UI'larını kopyalamaz.

---

# J — “Şimdi değil” / snooze

Kullanıcının daha önceki Pusula davranışıyla uyumlu:
- görev gerçekten kritik değilse `Şimdi değil` olabilir,
- task `snoozedUntil` ile ör. 3/7 gün saklanır,
- aynı oturumda tekrar tekrar dürtmez,
- snooze puan vermez,
- kritik zamanlı işte snooze süresi daha kısa olabilir.

Görev silinmez; yalnız aktif listeden geçici gizlenir.

---

# K — Supabase taslak şeması

Bu yalnız hazırlık taslağıdır. Gerçek migration zamanı Supabase güncel changelog/docs kontrol edilerek oluşturulur.

## `user_tasks`

```text
id uuid pk
user_id uuid not null
field_id uuid null
task_key text not null
kind text not null
source text not null
title text not null
reason text null
priority text not null
target_json jsonb not null
reward_rule_key text null
reward_points_snapshot integer not null default 0
status text not null
snoozed_until timestamptz null
due_at timestamptz null
completion_evidence_json jsonb null
blocking_capabilities text[] null
created_at timestamptz
updated_at timestamptz
completed_at timestamptz null
```

Unique:

```text
(user_id, task_key)
```

RLS:
- user yalnız kendi task kayıtlarını SELECT edebilir.
- reward/status alanlarını client keyfi UPDATE edemez.
- task completion transaction server/RPC üzerinden doğrulanır.

## İsteğe bağlı `task_reward_rules`

Reward catalog database'de tutulacaksa:

```text
rule_key
points
repeat_policy
max_per_period
active
version
```

Mevcut gamification rule altyapısıyla tek otorite olacak şekilde entegre edilir; iki ayrı puan kural sistemi yaratılmaz.

---

# L — Completion API / transaction taslağı

```ts
type CompleteTaskRequest = {
  taskId: string;
  completionRef?: string;
};
```

Server akışı:

```text
auth user
 -> task belongs to user?
 -> status active/snoozed?
 -> completion condition gerçekten sağlandı mı?
 -> lock/idempotency
 -> award existing reward rule once
 -> task status completed
 -> return new point total + awarded amount
```

Önemli: task status `completed` olup puan yazılamazsa veya puan yazılıp task active kalırsa yarım transaction istemiyoruz. DB tarafında atomik çözüm hedeflenir.

---

# M — Event sözleşmesi

Mevcut feature'lar task engine'i doğrudan manipüle etmez; domain event çıkarır:

```text
tp:field-context-updated
tp:field-operation-created
tp:field-observation-created
tp:soil-analysis-created
tp:season-updated
tp:task-completed
```

Task engine event sonrası ilgili adayları tekrar hesaplar.

Örneğin mevcut `tp:field-context-updated`, sulama durumu kaydı sonrası task'ı kapatmak için yeniden kullanılabilir.

---

# N — Pusula ile ilişki

Pusula artık eksik veri için kullanıcıyı her ekranda ayrı ayrı bölmez.

Önerilen davranış:

```text
Pusula: “Bu tarla için 2 bilgi eksik. Görevlerim'e ekledim.”
```

veya doğrudan task sheet açma aksiyonu.

Pusula hâlâ kullanıcıyla mini diyalog yapabilir; fakat cevaplanmamış actionable soru task olarak tek merkezde yaşar.

Görev tamamlandıktan sonra Pusula ilgili yeni veriyi sonraki analizde kullanır.

---

# O — İlk reward catalog önerisi

Bu tablo implementasyon öncesi son kez ürün dengesi için gözden geçirilebilir; ilk teknik varsayılan olarak hazırdır.

```text
TASK_FIELD_IRRIGATION_STATUS       20
TASK_FIELD_PLANTING_DATE           20
TASK_FIELD_CANOPY_DEVELOPMENT      15
TASK_FIELD_CANOPY_HEIGHT           15
TASK_IRRIGATION_RECORD             20
TASK_FIELD_OBSERVATION_PHOTO       20
TASK_CROP_STAGE_OBSERVATION        20
TASK_ACTUAL_SEASON_YIELD           30
```

Toprak analizi/depo/ürün/hastalık analizi gibi mevcut `POINT_RULES` olan eylemlerde **mevcut kural kullanılır**.

---

# P — Kabul kriterleri

- [ ] Görevlerim iconu haritadaki eski fullscreen iconunun yerinde
- [ ] aktif görev count badge var, yoksa badge yok
- [ ] tasks user/field bazlı
- [ ] duplicate task yok
- [ ] eksik veri task'a dönüşebiliyor
- [ ] göreve basınca doğru mevcut feature akışı açılıyor
- [ ] gerçek completion olmadan puan yok
- [ ] reward client tarafından değiştirilemiyor
- [ ] completion + reward idempotent
- [ ] aynı eksik veriyi değiştirip tekrar puan kazanılamıyor
- [ ] completion sonrası task active listeden kalkıyor
- [ ] audit/history backend'de kalıyor
- [ ] `+20P` gibi reward görsel olarak ikincil
- [ ] puan kümülatif; harcama yok
- [ ] notifications ile aynı item iki yerde kart olarak çoğalmıyor
- [ ] Pusula eksik veriyi task merkeziyle koordine ediyor
- [ ] task motoru fail olursa ana harita/uydu/field akışı çalışmaya devam ediyor

## Önerilen implementation branch'ler

```text
feat/task-engine-core
feat/task-pusula-points
feat/map-task-sheet
```

Küçük ve geri alınabilir PR'lar tercih edilir.
