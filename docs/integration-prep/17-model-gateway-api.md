# 17 — Model Gateway API sözleşmesi

Bu doküman deployment seçmez. Amaç React/Supabase tarafını Python/ML motorunun nerede çalıştığından bağımsız tutmaktır.

## Güven sınırı

```text
React / Mobile UI
  -> authenticated TarlaPusula backend
      -> authorization + input normalization
          -> Model Gateway (private)
              -> pinned model runner
```

Frontend Model Gateway'e doğrudan erişmez.

## Temel endpoint

```http
POST /v1/models/{engine}/run
```

Örnek engine değerleri:
- `pyfao56`
- `pcse-wofost`
- `aquacrop`
- `autogeobound`
- `pest-risk`

## Request

```json
{
  "requestId": "uuid",
  "mode": "shadow",
  "adapterVersion": "1",
  "inputFingerprint": "sha256:...",
  "window": {
    "from": "2026-06-01",
    "to": "2026-06-07"
  },
  "input": {},
  "options": {}
}
```

### Kurallar

- Model Gateway'e mümkünse `user_id`, e-posta, telefon, isim gibi kullanıcı kimliği gönderilmez.
- `fieldId` model hesabı için gerekmiyorsa gönderilmez; correlation backend'de tutulur.
- Geometri gerçekten gerekiyorsa yalnız gerekli geometri gönderilir.
- `inputFingerprint` backend tarafından üretilir.
- `requestId` tracing/idempotency için kullanılır.
- `mode` gateway'in iş mantığını değiştirmek zorunda değildir; audit/telemetry etiketi olarak taşınabilir.

## Senkron response

```json
{
  "requestId": "uuid",
  "status": "ok",
  "engine": "pyfao56",
  "engineVersion": "1d242ee985be0edbc4946f06e7e94a487d4bc0c9",
  "adapterVersion": "1",
  "generatedAt": "2026-09-13T12:00:00Z",
  "inputFingerprint": "sha256:...",
  "data": {},
  "quality": {
    "inputCompleteness": 1,
    "flags": []
  },
  "evidence": [],
  "warnings": [],
  "durationMs": 123
}
```

Bu response backend'de TarlaPusula `IntegrationResult<T>` tipine map edilir. Gateway output'u doğrudan React component'e verilmez.

## Hata response standardı

HTTP kodu + makine okunabilir hata kodu birlikte kullanılır.

```json
{
  "requestId": "uuid",
  "status": "invalid_input",
  "error": {
    "code": "MISSING_SOIL_PROFILE",
    "message": "Required soil profile is missing",
    "retryable": false
  },
  "warnings": []
}
```

Önerilen kodlar:

```text
INVALID_INPUT
MISSING_WEATHER_DATA
MISSING_SOIL_PROFILE
MISSING_CROP_PARAMETERS
MODEL_NOT_AVAILABLE
MODEL_TIMEOUT
MODEL_EXECUTION_ERROR
UNSUPPORTED_CROP
UNSUPPORTED_GEOMETRY
RATE_LIMITED
```

Kullanıcıya teknik hata mesajı aynen gösterilmez. Domain katmanı uygun no-data mesajına çevirir.

## HTTP durumları

- `200` başarılı veya kontrollü model sonucu
- `400` schema/input hatası
- `401/403` sadece service-to-service auth problemi
- `409` idempotency/input-version uyuşmazlığı gibi conflict
- `422` semantik olarak çalıştırılamayan input
- `429` gateway rate limit
- `500` beklenmeyen runner hatası
- `503` motor geçici kullanılamıyor
- `504` timeout

## Service-to-service auth

Gateway public internetten erişilebilir olsa bile endpoint private/authenticated olmalıdır.

Tercih seçenekleri:
- kısa ömürlü signed service token,
- platform private networking,
- workload identity,
- service secret + rotation (son tercih).

Frontend'de gateway credential olmaz.

## Idempotency

Header önerisi:

```http
Idempotency-Key: <requestId-or-input-fingerprint>
```

Aynı model/version/input için gereksiz ağır hesap tekrarını azaltabilir.

Cache anahtarı en az:

```text
engine
engineVersion
adapterVersion
inputFingerprint
window
```

alanlarını içerir.

## Version endpoint

```http
GET /v1/models/{engine}/version
```

Örnek:

```json
{
  "engine": "pcse-wofost",
  "engineVersion": "67a28e56b0e34655f8d60b0b4a254a7c81efbb2f",
  "adapterVersion": "1",
  "buildDigest": "sha256:..."
}
```

TarlaPusula backend registry ile runtime version uyuşmuyorsa production result kabul etmeyebilir.

## Health endpoint

```http
GET /healthz
```

Sadece servis sağlığını bildirir; model doğruluğunu değil.

```json
{
  "status": "ok",
  "engines": {
    "pyfao56": "ready",
    "pcse-wofost": "ready"
  }
}
```

## Ağır işler için async job

AquaCrop çoklu senaryo, büyük segmentation veya FarmVibes benzeri işler senkron HTTP süresine sığmayabilir.

Başlatma:

```http
POST /v1/models/{engine}/jobs
```

Response:

```json
{
  "jobId": "uuid",
  "status": "queued"
}
```

Durum:

```http
GET /v1/jobs/{jobId}
```

Sonuç hazır olunca backend alır ve kullanıcıya kendi domain modeli üzerinden sunar.

İlk pyfao56/PCSE küçük pilotunda gereksiz yere job queue kurmayacağız; gerçekten süre/maliyet gerektirirse açılır.

## Timeout politikası

Timeout motor bazlıdır.

Gateway iki timeout taşır:
- model execution timeout
- overall request timeout

Timeout olduğunda sahte sonuç yok. Backend varsa geçerli cache'e düşer; yoksa no-data/fallback.

## Input schema version

Model pininden ayrı olarak input contract da versionlanmalı:

```json
{
  "schemaVersion": "water-balance-input/v1"
}
```

Böylece adapter değişince eski cache/run ile yeni input karışmaz.

## Privacy / minimization

Gateway loglarında varsayılan olarak bulunmamalı:
- kullanıcı adı/e-posta/telefon
- tam auth token
- ham fotoğrafın kalıcı kopyası
- gereksiz tam koordinat
- tüm Supabase row dump'ı

Model inference için fotoğraf gerekiyorsa lifecycle ayrıca tanımlanır: upload -> inference -> retention/delete policy.

## Observability

Gateway şu operasyon metriklerini döndürebilir/loglayabilir:

```text
engine
engine_version
status
duration_ms
queue_ms
cache_hit
input_completeness
quality_flags
error_code
```

Ham tarla verisi telemetry etiketi olmaz.

## Pusula ile sınır

Gateway asla doğal dil tavsiyesi üretmek zorunda değildir. Tercih:

```text
model -> ölçüm/sinyal
TarlaPusula decision engine -> karar bağlamı
Pusula AI -> kısa açıklama
```

Örneğin PCSE `stageLabel=flowering` döndürür; “yarın gübre at” cümlesini PCSE veya gateway üretmez.

## İlk uygulama

`feat/pyfao56-shadow` sırasında minimum gateway contract:

1. `/healthz`
2. `/v1/models/pyfao56/version`
3. `/v1/models/pyfao56/run`
4. deterministic input/output fixture test
5. timeout/error response testi

Bundan fazlası ilk PR'a doldurulmaz.
