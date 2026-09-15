# 18 — Uygulama dosya haritası

Bu dosya **gelecekte hangi dosyaların oluşturulacağı/değiştirileceği** listesidir. Hazırlık branch'inde bu production dosyaları şu anda oluşturulmaz.

TarlaPusula kalıcı mimari kuralı korunur:

- `HomeScreen.tsx` yalnız kompozisyon/yerleşim.
- external API/model çağrısı component içine girmez.
- feature -> hook -> domain service -> integration adapter sınırı korunur.
- Supabase / model gateway çağrısı service/adapter katmanındadır.
- çalışan mevcut motor yeni entegrasyon doğrulanana kadar silinmez.

---

# Ortak çekirdek — ilk motorla birlikte

İlk gerçek entegrasyon PR'ında önerilen yeni dosyalar:

```text
src/integrations/
  contracts.ts
  modelGateway.client.ts
  integrationFlags.service.ts
  integrationTelemetry.service.ts
```

### `contracts.ts`

`IntegrationResult`, `IntegrationQuality`, `IntegrationEvidence`, ortak error/status tipleri.

### `modelGateway.client.ts`

Sadece trusted TarlaPusula backend endpoint'ini çağırır; frontend'den private gateway'e direkt erişim yok.

Eğer frontend doğrudan Edge Function çağırıyorsa Edge Function authorization boundary ve model gateway bridge rolünü üstlenir.

### `integrationFlags.service.ts`

Server-side rollout bilgisini normalize eder. UI sadece “bu sonuç kullanılabilir mi?” bilgisini alır; secret/operasyon config görmez.

### `integrationTelemetry.service.ts`

Gerekirse shadow kıyas metriklerini backend'e yollar. Hassas veri loglamaz.

---

# P0 — pyfao56 shadow

## Yeni dosyalar

```text
src/integrations/pyfao56/
  pyfao56.types.ts
  pyfao56.mapper.ts
  pyfao56.validation.ts
  pyfao56.adapter.ts

src/features/irrigation/services/
  irrigationModelComparison.service.ts

src/features/irrigation/types/
  irrigationModelComparison.ts
```

Backend tarafı deployment seçimine göre:

```text
supabase/functions/pyfao56-bridge/
  index.ts
```

veya trusted backend bridge + ayrı model gateway.

Python runner kendi servis/repo/container alanında tutulabilir; React source içine Python package kopyalanmaz.

## Dokunulacak mevcut alanlar

- `src/features/irrigation/services/cropWaterUse.service.ts` — **değiştirilmez/otorite olarak kalır**; karşılaştırma için output okunur.
- `src/features/irrigation/services/irrigationDecision.service.ts` — ilk shadow PR'da karar mantığı değiştirilmez.
- `src/features/irrigation/hooks/useHomeIrrigationDecision.ts` — ilk shadow PR'da kullanıcıya yeni sonuç göstermesi gerekmez.

## İlk görünür UI

İlk shadow PR'da **hiç görünür kullanıcı UI'sı olmayabilir**. Admin/test görünümü gerekirse ayrı component:

```text
src/features/irrigation/components/IrrigationModelDebugPanel.tsx
```

Production UI'ya bağlama sonraki PR.

---

# P0 — PCSE / WOFOST

## Yeni dosyalar

```text
src/integrations/pcse/
  pcse.types.ts
  pcse.mapper.ts
  pcse.validation.ts
  pcse.adapter.ts

src/features/phenology/services/
  pcsePhenologyComparison.service.ts

src/features/phenology/types/
  pcsePhenology.ts
```

## Mevcut alanlarla ilişki

- `src/features/phenology/services/phenologyEngine.ts` — mevcut kendi motorumuz benchmark baseline'ı olarak korunur.
- `src/features/phenology/services/fieldPhenologyContext.service.ts` — PCSE input hazırlığında kullanılabilecek normalize bağlam.
- `src/features/field-detail/components/PcsePilotReadiness.tsx` — veri readiness göstergesi varsa pilot kontrol ekranı için kullanılabilir/güncellenebilir.
- `src/features/field-detail/services/seasonModelInputs.service.ts` — gerçek sezon input readiness kaynağı olabilir.

## Dokunulmaması gereken yer

PCSE sonucu doğrudan `HomeScreen.tsx` içine çağrı olarak eklenmez.

---

# P1 — AquaCrop

## Yeni dosyalar

```text
src/integrations/aquacrop/
  aquacrop.types.ts
  aquacrop.mapper.ts
  aquacrop.validation.ts
  aquacrop.adapter.ts

src/features/irrigation/services/
  irrigationScenario.service.ts

src/features/irrigation/types/
  irrigationScenario.ts
```

UI ancak model doğrulandıktan sonra:

```text
src/features/irrigation/components/IrrigationScenarioSheet.tsx
```

## Bağlam kaynakları

- mevcut crop coefficient profilleri
- soil water profile
- irrigation operation records
- season model inputs
- weather normalization

AquaCrop kendi ikinci hava sağlayıcısını doğrudan componentten çekmez.

---

# P1 — AutoGeoBound

## Yeni dosyalar

```text
src/integrations/autogeobound/
  autogeobound.types.ts
  autogeobound.validation.ts
  autogeobound.adapter.ts

src/features/fields/services/
  boundarySuggestion.service.ts

src/features/fields/types/
  boundarySuggestion.ts
```

UI:

```text
src/features/fields/components/BoundarySuggestionOverlay.tsx
src/features/fields/components/BoundarySuggestionReviewSheet.tsx
```

## Bağlanacak mevcut akış

- `src/pages/AddFieldScreen.tsx` veya güncel tarla ekleme feature controller
- mevcut TerraDraw/MapLibre çizim akışı
- `fieldService.ts` kayıt işlemi

## Kritik kural

`fieldService.ts` önerilen geometriyi otomatik kaydetmez. Save yalnız kullanıcı review/confirm sonrası yapılır.

---

# P1 — Pest/Disease risk engine

## Yeni dosyalar

```text
src/integrations/pest-risk/
  pestRisk.types.ts
  pestRisk.mapper.ts
  pestRisk.adapter.ts

src/features/pest-risk/
  services/buildFieldPestRisk.ts
  hooks/useFieldPestRisk.ts
  types/pestRisk.ts
```

## Mevcut kaynaklar

- `src/services/field-biodiversity-context.ts` — GBIF kanıtı
- `src/components/GbifObservationMap.tsx` — sadece görselleştirme; karar motoru buradan veri okumaz
- weather service/hook — sıcaklık/nem/GDD girdisi
- phenology context — ürün evresi
- field observations — saha fotoğraf/gözlem sinyali

## Pusula bağlantısı

Pest risk result -> decision evidence -> Pusula.

Doğrudan `OpenAgri -> Pusula natural language` bağlantısı yapılmaz.

---

# P2 — Disease model V2 / AgML

## Yeni dosyalar

Üretim modeline karar verilmeden kesin dosya açılmaz. Muhtemel sınır:

```text
src/integrations/disease-model/
  diseaseModel.types.ts
  diseaseModel.adapter.ts
  diseaseModel.validation.ts
```

Mevcut AI Analysis ekranı sadece domain sonucu tüketir.

`src/pages/AiAnalysis/AiAnalysisScreen.tsx` içine model SDK'sı / credential / inference implementation konmaz.

---

# P2 — OpenET

## Yeni dosyalar

```text
src/integrations/openet/
  openEt.types.ts
  openEt.adapter.ts
  openEt.validation.ts

src/features/irrigation/services/
  remoteEtComparison.service.ts
```

OpenET sonucu ana `irrigationDecision.service.ts` otoritesi yapılmadan önce uzun süre yardımcı/shadow sinyal olarak tutulur.

---

# P2 — FarmVibes seçili modüller

Full FarmVibes stack için uygulama dosyası açılmaz.

Her seçilen yetenek ayrı feature olur. Örneğin gerçekten değer sağlarsa:

```text
src/integrations/satellite-fusion/
  satelliteFusionModel.adapter.ts
```

veya

```text
src/integrations/crop-segmentation/
  cropSegmentation.adapter.ts
```

Mevcut `src/features/satellite/services/satelliteFusion.service.ts` ile isim/otorite çakışması incelenmeden yeni motor eklenmez.

---

# Supabase migration stratejisi

Hazırlık dokümanındaki tüm tablo taslakları tek dev migration'a dönüştürülmez.

Her entegrasyon kendi ihtiyacı kadar migration ekler:

```text
supabase/migrations/YYYYMMDDHHMMSS_integration_runs.sql
supabase/migrations/YYYYMMDDHHMMSS_model_registry.sql
```

Ancak gerçekten gerekli değilse tablo açılmaz.

İlk pyfao56 shadow pilotu için mümkünse mevcut log/telemetry düzeni değerlendirildikten sonra minimal tablo seçilir.

---

# Test dosya haritası

Her integration için:

```text
*.test.mjs / *.test.ts
```

minimum testler:
- mapper
- validation
- no-data
- timeout mapping
- version mismatch
- cache key/fingerprint
- authorization backend test

Modelin Python tarafında kendi unit/regression testleri ayrı tutulur.

---

# HomeScreen kuralı

`src/pages/Home/HomeScreen.tsx` içine şunlar girmeyecek:

- `fetch()` ile model çağrısı
- Supabase integration_runs query'si
- PCSE/AquaCrop mapping kodu
- external provider type'ları
- lisans/provider branching

Home ancak hazır feature hook/component sonucunu render eder.

---

# İlk üç implementation PR dosya kapsamı

## PR 1 — `feat/pyfao56-shadow`

Beklenen kapsam:
- common integration contracts (minimal)
- pyfao56 adapter/types/validation
- trusted bridge/gateway client
- shadow comparison service
- telemetry/run record
- tests
- **mevcut sulama kararını değiştirmez**

## PR 2 — `feat/pcse-pilot`

Beklenen kapsam:
- PCSE adapter
- season input mapper/readiness
- comparison against own phenology engine
- admin/test pilot output
- tests
- **ana evre otoritesini hemen değiştirmez**

## PR 3 — `feat/aquacrop-scenarios`

Beklenen kapsam:
- AquaCrop adapter
- scenario request/result
- async job gerekiyorsa gateway job contract
- internal scenario comparison UI
- tests
- **anasayfada otomatik yield vaadi yok**

---

# Değişiklik öncesi kontrol

Her implementation PR başlamadan:

1. `main` güncel mi?
2. mevcut ilgili feature dosyaları değişti mi?
3. upstream pin hâlâ seçilen pin mi?
4. lisans/terms değişti mi?
5. data readiness var mı?
6. test fixture hazır mı?
7. feature flag default off mu?
8. rollback net mi?

Bu liste geçmeden production dosyasına dokunma.
