# P1 — AquaCrop-OSPy entegrasyon hazırlık paketi

## Amaç

Yıllık ürünlerde su stresi, sulama senaryosu ve sezon sonucu ilişkisini modellemek. İlk hedef kullanıcıya kesin verim vaat etmek değil; farklı sulama senaryolarının göreli etkisini güvenli ve açıklanabilir biçimde karşılaştırmak.

Resmi repo: `aquacropos/aquacrop`

## Bugünkü durum

- TarlaPusula reposunda AquaCrop bağımlılığı yok.
- `tools/crop-model-readiness/` veri yeterliliği açısından AquaCrop pilotuna da zemin hazırlıyor.
- Mevcut Irrigation Engine günlük karar üretmeye odaklı; AquaCrop daha çok sezon/senaryo katmanı olarak düşünülmeli.

## Lisans kapısı

Repo notlarımızda AquaCrop-OSPy Apache 2.0 olarak kayıtlı. Üretimden önce sürüm ve bağımlılık lisansları tekrar doğrulanacak.

## İlk kapsam

İlk pilot yalnızca yıllık ürün:
- buğday,
- mısır,
- arpa,
- ayçiçeği

gibi sezonu net ürünlerde yapılır.

Çok yıllık badem/kiraz gibi bahçeler ilk pilot kapsamı dışındadır.

## Girdi sözleşmesi

```ts
type AquaCropSeasonInput = {
  fieldId: string;
  crop: string;
  variety?: string;
  plantingDate: string;
  harvestOrEndDate: string;
  weather: Array<{
    date: string;
    tminC: number;
    tmaxC: number;
    precipitationMm: number;
    et0Mm: number;
  }>;
  soil: {
    profileSource: 'lab' | 'soilgrids' | 'manual' | 'unknown';
    layers: Array<{
      depthFromM: number;
      depthToM: number;
      fieldCapacity?: number;
      wiltingPoint?: number;
      saturatedWaterContent?: number;
      hydraulicConductivity?: number;
    }>;
  };
  initialWater?: Array<{
    depthM: number;
    value: number;
  }>;
  irrigationEvents: Array<{
    date: string;
    amountMm: number;
  }>;
};
```

## Senaryo sözleşmesi

İlk sürümde en az iki senaryo zorunlu:

```ts
type AquaCropScenario = {
  id: string;
  label: string;
  strategy: 'observed' | 'rainfed' | 'threshold' | 'fixed';
  parameters: Record<string, number | string | boolean>;
};
```

Örnek:
- Gerçekte uygulanan sulama,
- Yağmura bırakılmış senaryo,
- Belirli toprak su açığı eşiğinde sulama.

## Çıktı sözleşmesi

```ts
type AquaCropSeasonResult = {
  scenarioId: string;
  seasonalIrrigationMm?: number | null;
  simulatedBiomass?: number | null;
  simulatedYield?: number | null;
  waterProductivity?: number | null;
  stressDays?: number | null;
  daily?: Array<{
    date: string;
    soilWater?: number | null;
    canopyCover?: number | null;
    waterStress?: number | null;
  }>;
};
```

`simulatedYield` doğrulanmadan kullanıcıya beklenen gerçek verim gibi sunulmaz.

## Adapter planı

```text
src/integrations/aquacrop/
  types.ts
  mapper.ts
  validation.ts
  scenarioBuilder.ts
  adapter.ts

supabase/functions/aquacrop-bridge/
  index.ts
```

## Supabase planı

Ayrı model sonuç tablosu yerine ortak `crop_model_runs` tercih edilebilir:

```text
crop_model_runs
- id
- user_id
- field_id
- season_id
- engine
- engine_version
- scenario_id
- input_hash
- result_json
- evidence_json
- status
- created_at
```

## Feature flag

```text
VITE_ENABLE_ENGINE_AQUACROP=false
ENABLE_ENGINE_AQUACROP=false
```

## Test senaryoları

1. Resmi örnek veri seti regression.
2. Aynı sezon + iki farklı sulama senaryosu.
3. Sulama geçmişi yok → observed senaryo çalışmaz.
4. Toprak parametreleri yetersiz → `insufficient_data`.
5. Tam sezon hava içinde eksik gün → pilot reddi.
6. Aynı input hash → tekrar üretilebilir sonuç.
7. Gerçek sezon sonunda ölçülmüş verim varsa model sonucu ile karşılaştırma.

## Başarı ölçütü

İlk hedef mutlak verim doğruluğu değil:
- senaryoların yönü mantıklı mı,
- su kullanımı farkı tekrar üretilebilir mi,
- saha kaydı ile model stres günleri örtüşüyor mu,
- model mevcut Irrigation Engine'in günlük önerileriyle çelişirse neden açıklanabiliyor mu.

## Pusula bağlantısı

Örnek güvenli çıktı:

```text
Bu sezon model karşılaştırmasında mevcut sulama senaryosu, yağmura bırakılan senaryoya göre daha düşük su stresi gösteriyor.

Neden bunu öneriyorum?
- AquaCrop senaryosu: X mm toplam sulama
- Model stres günü: Y
- Toprak verisi: laboratuvar / tahmini
```

`% şu kadar verim artar` gibi kesin ifade, saha doğrulaması olmadan kullanılmaz.

## Sınır kalkınca ilk iş

1. PCSE için seçilen yıllık test tarlasından aynı sezon verisini kullan.
2. Toprak su parametrelerini yeterlilik kontrolünden geçir.
3. Gerçek sulama olaylarını tarih + mm olarak hazırla.
4. Observed ve alternatif bir senaryo çalıştır.
5. Sezon sonunda ölçüm varsa kıyasla; yoksa yalnızca araştırma sonucu olarak tut.
