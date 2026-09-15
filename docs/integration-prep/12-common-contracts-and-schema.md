# 12 — Ortak adapter sözleşmeleri ve Supabase schema taslağı

Bu dosya **uygulanmış migration değildir**. Sadece sınır kalktığında motorların farklı formatlarda uygulamayı kirletmemesi için ortak sözleşme taslağıdır.

## 1. Ortak model sonucu

```ts
export type IntegrationStatus =
  | 'ok'
  | 'partial'
  | 'no_data'
  | 'invalid_input'
  | 'provider_error';

export interface IntegrationEvidence {
  code: string;
  label: string;
  value?: string | number | null;
  unit?: string;
  observedAt?: string;
  source?: string;
}

export interface IntegrationQuality {
  score?: number | null; // 0..1, only if meaningful
  inputCompleteness?: number | null;
  stale?: boolean;
  sourceAgeDays?: number | null;
  flags: string[];
}

export interface IntegrationResult<T> {
  status: IntegrationStatus;
  engine: string;
  engineVersion: string;
  adapterVersion: string;
  generatedAt: string;
  validFrom?: string;
  validTo?: string;
  inputFingerprint: string;
  data: T | null;
  quality: IntegrationQuality;
  evidence: IntegrationEvidence[];
  warnings: string[];
}
```

## 2. Motorlar için normalize output örnekleri

### Irrigation / pyfao56

```ts
export interface WaterBalanceResult {
  referenceEtMm?: number | null;
  cropEtMm?: number | null;
  rootZoneDepletionMm?: number | null;
  readilyAvailableWaterMm?: number | null;
  stressCoefficient?: number | null;
  suggestedIrrigationMm?: number | null;
  irrigationNeeded?: boolean | null;
}
```

Not: `suggestedIrrigationMm` modelden gelse bile doğrudan kullanıcı emri değildir; TarlaPusula decision layer ayrıca hava, sulama durumu ve gerçek operasyon kaydını kontrol eder.

### PCSE / phenology

```ts
export interface CropModelResult {
  developmentStage?: number | null;
  stageLabel?: string | null;
  predictedAnthesisDate?: string | null;
  predictedMaturityDate?: string | null;
  lai?: number | null;
  biomassKgHa?: number | null;
  yieldKgHa?: number | null;
  waterStressIndex?: number | null;
}
```

### AquaCrop

```ts
export interface AquaCropScenarioResult {
  scenarioId: string;
  seasonalIrrigationMm?: number | null;
  seasonalEtMm?: number | null;
  biomassTonneHa?: number | null;
  yieldTonneHa?: number | null;
  waterProductivity?: number | null;
}
```

### AutoGeoBound

```ts
export interface BoundaryCandidate {
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  confidence?: number | null;
  sourceImageDate?: string | null;
  areaHa?: number | null;
  qualityFlags: string[];
}
```

### Pest/Disease risk

```ts
export interface PestRiskResult {
  organismId: string;
  riskBand: 'low' | 'medium' | 'high' | 'unknown';
  riskScore?: number | null;
  gdd?: number | null;
  modelName: string;
}
```

---

## 3. Pusula'ya giden ortak kanıt formatı

Pusula ham model objesi görmemeli.

```ts
export interface DecisionEvidence {
  id: string;
  fieldId: string;
  category:
    | 'weather'
    | 'satellite'
    | 'irrigation'
    | 'phenology'
    | 'soil'
    | 'pest'
    | 'inventory'
    | 'operation';
  statement: string;
  observedAt?: string;
  source: string;
  confidence?: 'low' | 'medium' | 'high';
  stale?: boolean;
}
```

Pusula'nın kısa önerisindeki “Neden bunu öneriyorum?” maddeleri bu kanıtlardan türetilir.

---

## 4. Supabase schema taslağı

### `integration_runs`

Amaç: shadow/pilot/production motor koşularını audit etmek.

```sql
create table integration_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  field_id uuid not null,
  engine text not null,
  engine_version text not null,
  adapter_version text not null,
  mode text not null check (mode in ('shadow','pilot','production')),
  input_fingerprint text not null,
  status text not null,
  quality jsonb not null default '{}'::jsonb,
  result_summary jsonb,
  warnings jsonb not null default '[]'::jsonb,
  duration_ms integer,
  created_at timestamptz not null default now()
);
```

Kural: ham kullanıcı fotoğrafı, secret, tam hava ham cevabı gibi gereksiz veri buraya yazılmaz.

### `integration_model_registry`

```sql
create table integration_model_registry (
  engine text not null,
  engine_version text not null,
  adapter_version text not null,
  upstream_repo text,
  upstream_commit text,
  code_license text,
  data_license text,
  enabled boolean not null default false,
  rollout_mode text not null default 'off',
  config jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  primary key (engine, engine_version, adapter_version)
);
```

### `field_external_ids`

Sadece gerekirse:

```sql
create table field_external_ids (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null,
  provider text not null,
  external_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(field_id, provider)
);
```

AgStack GeoID bu tabloya girebilir; ana `fields.id` değişmez.

### `field_model_snapshots`

Sadece gerçekten tarihsel model çıktısına ihtiyaç varsa:

```sql
create table field_model_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  field_id uuid not null,
  engine text not null,
  snapshot_date date not null,
  input_fingerprint text not null,
  payload jsonb not null,
  quality jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(field_id, engine, snapshot_date, input_fingerprint)
);
```

Bu tablo her motor için otomatik açılmayacak. Gerçek ürün ihtiyacı varsa migration yapılır.

---

## 5. RLS kuralları

Her kullanıcıya ait model kaydı `user_id = auth.uid()` ile sınırlandırılmalı.

Ek olarak `field_id` sahipliği backend tarafında doğrulanmalı.

Model servisinden gelen `field_id` istemciden güvenilir kabul edilmez.

---

## 6. Service katmanı önerisi

```text
src/integrations/
  contracts.ts
  pyfao56/
    pyfao56.adapter.ts
    pyfao56.types.ts
  pcse/
    pcse.adapter.ts
    pcse.types.ts
  aquacrop/
    aquacrop.adapter.ts
    aquacrop.types.ts
  autogeobound/
    autogeobound.adapter.ts
    autogeobound.types.ts
```

Ancak bunlar hazırlık sırasında oluşturulmaz. İlgili entegrasyon gerçekten başladığında ayrı PR'da eklenir.

---

## 7. Feature katmanına geçiş

Entegrasyon adapter'ı UI bileşenine import edilmez.

Doğru:

```text
adapter -> domain service -> hook -> component
```

Yanlış:

```text
React component -> external API/model
```

---

## 8. Null/no-data kuralı

Motor veri üretemezse:

```json
{
  "status": "no_data",
  "data": null,
  "warnings": ["soil_profile_missing"]
}
```

olmalı.

Şunlar yasak:
- varsayılan sahte pH,
- sahte yağış,
- rastgele confidence,
- eksik tarla bilgisine demo verisi doldurmak,
- eski cache'i güncelmiş gibi göstermek.

---

## 9. Tarih/kanıt zorunluluğu

Kullanıcıya gösterilecek önemli her model sonucu mümkünse şunları taşımalı:
- hangi tarihe ait,
- hangi tarla için,
- hangi motor sürümü,
- hangi temel veri kaynakları,
- veri tazeliği.

Bu bilgiler ana kartı kalabalıklaştırmaz; “Neden?” / detay alanında gösterilir.
