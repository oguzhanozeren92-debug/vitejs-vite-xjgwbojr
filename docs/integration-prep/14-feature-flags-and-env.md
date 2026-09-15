# 14 — Feature flag ve ortam değişkeni planı

Bu dosya hazırlık şemasıdır; mevcut `.env` dosyasına veya Vercel/Supabase secret'larına şu anda değişiklik yapılmaz.

## Temel ilke

Model entegrasyonları iki ayrı şeyle kontrol edilir:

1. **secret/config** — backend'in motoru çağırabilmesi
2. **feature flag** — ürünün o motor sonucunu kullanıp kullanmaması

Bir secret var diye özellik açık sayılmaz.

---

## Flag isimleri

```text
ENABLE_PYFAO56=false
ENABLE_PCSE=false
ENABLE_AQUACROP=false
ENABLE_AUTOGEOBOUND=false
ENABLE_PEST_RISK_ENGINE=false
ENABLE_DISEASE_MODEL_V2=false
ENABLE_OPENET=false
ENABLE_FARMVIBES_EXPERIMENT=false
ENABLE_AGSTACK_GEOID=false
```

Production default: `false`.

---

## Rollout modları

Sadece boolean yeterli olmayabilir. Server-side config önerisi:

```ts
type RolloutMode = 'off' | 'shadow' | 'internal' | 'pilot' | 'production';
```

Örnek:

```json
{
  "engine": "pcse",
  "mode": "shadow",
  "allowedUserIds": [],
  "allowedFieldIds": [],
  "sampleRate": 1.0
}
```

---

## P0 — pyfao56

Muhtemel backend config:

```text
PYFAO56_MODEL_VERSION=
PYFAO56_TIMEOUT_MS=
PYFAO56_CACHE_TTL_SECONDS=
```

pyfao56 kendi başına üçüncü taraf API key gerektirmek zorunda değildir; hava girdisi TarlaPusula'nın normalize hava katmanından gelmelidir.

Kural: Python model runner'a Open-Meteo veya başka sağlayıcıyı doğrudan bağlayıp ikinci bir hava gerçeği yaratma.

---

## P0 — PCSE

```text
PCSE_MODEL_VERSION=
PCSE_TIMEOUT_MS=
PCSE_CACHE_TTL_SECONDS=
```

İlk pilot için crop/site/soil parametreleri versionlanmış config dosyalarından veya backend model registry'den gelmeli.

Frontend'e PCSE parametre dosyası/secret koyulmaz.

---

## P1 — AquaCrop

```text
AQUACROP_MODEL_VERSION=
AQUACROP_TIMEOUT_MS=
AQUACROP_CACHE_TTL_SECONDS=
```

Scenario run'ları kullanıcı ana ekranı yüklenirken senkron çalıştırılmamalı. Ağırsa job/run mantığı kullanılmalı.

---

## P1 — AutoGeoBound

Muhtemel değerler:

```text
AUTOGEOBOUND_MODEL_VERSION=
AUTOGEOBOUND_TIMEOUT_MS=
AUTOGEOBOUND_MAX_AREA_HA=
AUTOGEOBOUND_MIN_CONFIDENCE=
```

`MIN_CONFIDENCE` otomatik kaydetme eşiği değildir. Sadece öneriyi kullanıcıya göstermeden önce kalite filtresi olabilir.

---

## Pest risk engine

```text
PEST_RISK_MODEL_VERSION=
PEST_RISK_MAX_LOOKBACK_DAYS=
PEST_RISK_TIMEOUT_MS=
```

GBIF gibi dış sinyaller için ayrıca cache/age policy olmalı.

---

## OpenET

Eğer resmi servis/API erişimi credential gerektirirse yalnızca backend secret store'a konur.

Örnek isimler:

```text
OPENET_API_BASE_URL=
OPENET_API_KEY=
OPENET_TIMEOUT_MS=
OPENET_CACHE_TTL_SECONDS=
```

Gerçek alan isimleri sağlayıcı dokümanına göre entegrasyon gününde netleştirilir; burada uydurma endpoint/key adı production'a kopyalanmamalıdır.

---

## Sentinel Hub

Şimdilik HOLD. Pilot açılırsa:

```text
SENTINELHUB_CLIENT_ID=
SENTINELHUB_CLIENT_SECRET=
```

sadece trusted backend/model runner ortamında bulunur.

Mevcut Copernicus hattını değiştirmeden önce maliyet ve sonuç kıyası zorunlu.

---

## Google Earth Engine / geemap

geemap production runtime dependency olmadığı için Vercel frontend env'sine GEE credential eklenmez.

R&D hesabı ayrı tutulur.

---

## Secret yerleşim kuralı

### Frontend-visible env

Yalnızca public olması güvenli değerler.

### Supabase Edge / trusted backend secret

- external API credentials
- model gateway auth token
- private service URL

### Python model runner secret

- yalnızca runner'ın ihtiyaç duyduğu servis credential'ları

Bir secret'ı üç ortamın hepsine kopyalamamak.

---

## `VITE_` uyarısı

Vite'da `VITE_*` değişkenleri frontend bundle'a dahil olabilir. Bu yüzden:

**API key / secret / service credential için `VITE_*` kullanılmaz.**

Public Mapbox benzeri tarayıcı tokenlarının ayrı güvenlik modeli olabilir; her servis kendi kurallarına göre değerlendirilir.

---

## Flag okunma sırası

Öneri:

```text
server-side master flag
  -> rollout mode
  -> user/field eligibility
  -> data readiness
  -> model availability
  -> UI rendering
```

Data readiness yoksa feature flag açık olsa bile model koşmamalı.

---

## Kill switch

Her dış motor için tek noktadan kapatma olmalı.

Örnek olaylar:
- upstream model bug'ı
- provider outage
- beklenmedik maliyet
- yanlış yüksek güven
- lisans/terms değişikliği
- güvenlik problemi

Kill switch UI deploy'u gerektirmeden etkili olabilirse tercih edilir.

---

## Telemetry alanları

Secret olmayan operasyon metrikleri:

```text
engine
version
mode
status
latency_ms
cache_hit
quality_flags
input_completeness
provider_error_code
```

Log'a ham koordinat/fotoğraf/kişisel veri yazma.

---

## Cost guard

Harici API/model için:

```text
MAX_CALLS_PER_FIELD_PER_DAY
MAX_CALLS_PER_USER_PER_DAY
MAX_DAILY_PROVIDER_COST
```

mantığı değerlendirilmeli.

Özellikle uydu/ML senaryolarında kullanıcı her haritayı sürüklediğinde yeni model çağrısı yapılmamalı.

---

## Hazırlık checklist

Bir motorun env/flag hazırlığı tamam sayılırsa:

- [ ] secret listesi belli
- [ ] public/private ayrımı belli
- [ ] default flag off
- [ ] shadow mode tanımlı
- [ ] timeout tanımlı
- [ ] cache tanımlı
- [ ] rate/cost guard tanımlı
- [ ] kill switch tanımlı
- [ ] loglarda hassas veri yok
- [ ] rollback flag testi var
