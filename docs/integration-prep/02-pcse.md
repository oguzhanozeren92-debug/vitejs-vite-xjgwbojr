# P0 — PCSE / WOFOST entegrasyon hazırlık paketi

## Amaç

TarlaPusula'nın kendi fenoloji motorunu körlemesine değiştirmek değil; yıllık ürünlerde büyüme evresi ve sezon modellemesini bağımsız bir WOFOST/PCSE modeliyle karşılaştırmak.

Resmi repo: `ajwdewit/pcse`

## Bugünkü durum

- `tools/pcse-poc/` içinde gerçek PCSE paketiyle çalışan demo var.
- Demo güney İspanya / kışlık buğday örnek verisini kullanıyor.
- `tools/crop-model-readiness/check.py` gerçek pilot için veri yeterliliğini kontrol ediyor.
- Canlı TarlaPusula tarafında `src/features/phenology/` altında kendi TypeScript fenoloji motorumuz çalışıyor.

## Lisans kapısı

Repo notlarımızda PCSE lisansı EUPL 1.1 olarak kayıtlı. Üretim dağıtımı öncesi kullanılan PCSE sürümü ve transitif bağımlılıkların lisansları tekrar doğrulanacak.

## Pilot kapsamı

İlk gerçek pilot yalnızca **yıllık ürün** ile yapılır. Çok yıllık bahçe için ilk model doğrulamasında PCSE zorlanmaz.

Önerilen ilk ürünler:
- buğday,
- arpa,
- mısır,
- ayçiçeği

gibi tarihli ekim/hasat ve saha evresi toplanması daha kolay yıllık ürünler.

## Zorunlu girdi

```ts
type PcseSeasonInput = {
  fieldId: string;
  crop: string;
  variety?: string;
  sowingDate: string;
  endDate: string;
  latitude: number;
  longitude: number;
  elevationM?: number;
  dailyWeather: Array<{
    date: string;
    tminC: number;
    tmaxC: number;
    precipitationMm: number;
    radiationMjM2?: number;
    vapourPressureKpa?: number;
    windMS?: number;
  }>;
  soil: Record<string, number | string | null>;
  agromanagement: Array<{
    date: string;
    type: string;
    amount?: number;
    unit?: string;
  }>;
  fieldStageObservations: Array<{
    observedAt: string;
    stage: string;
  }>;
};
```

## Veri kapısı

Pilot başlatılmazsa sebebi kullanıcıya/gelistiriciye açık olmalı:

- tam sezon günlük hava yok,
- tarihli ekim yok,
- toprak/site parametresi yok,
- en az iki tarihli saha gelişim gözlemi yok,
- agromanagement eksik.

Eksik girdiler model tarafından tahmin edilip gerçekmiş gibi doldurulmaz.

## Çıktı sözleşmesi

```ts
type PcseSeasonResult = {
  emergenceDate?: string | null;
  anthesisDate?: string | null;
  maturityDate?: string | null;
  maxLai?: number | null;
  storageOrganBiomass?: number | null;
  daily?: Array<{
    date: string;
    dvs?: number | null;
    lai?: number | null;
  }>;
};
```

Biomass değeri doğrudan 'verim tahmini' etiketiyle kullanıcıya gösterilmez; sahada doğrulanmadan karar girdisi sayılmaz.

## Adapter planı

```text
src/integrations/pcse/
  types.ts
  mapper.ts
  validation.ts
  adapter.ts

supabase/functions/pcse-bridge/
  index.ts
```

Python modeli ön yüze paketlenmez.

## TarlaPusula eşlemesi

| TarlaPusula kaynağı | PCSE girdisi |
|---|---|
| `fields` | konum, alan, ürün bağlamı |
| sezon/üretim geçmişi | ekim ve sezon tarihleri |
| NASA POWER / doğrulanmış hava | günlük meteoroloji |
| toprak analizi / SoilGrids yalnızca uygun olduğu yerde | site/soil başlangıç parametreleri |
| field operations | agromanagement |
| field growth observations | model doğrulama gözlemleri |

SoilGrids tahmini laboratuvar ölçümü gibi etiketlenmez.

## Feature flag

```text
VITE_ENABLE_ENGINE_PCSE=false
ENABLE_ENGINE_PCSE=false
```

## Test senaryoları

1. Resmi PCSE demo regression.
2. Aynı sezon verisi iki kez → deterministik sonuç.
3. Eksik günlük hava → `insufficient_data`.
4. Saha gözlemi olmayan sezon → model çalışsa bile Pusula'ya güvenli karar taşınmaz.
5. TarlaPusula fenoloji motoru vs PCSE evre tarihleri yan yana.
6. Hasat edilmiş sezon için güncel büyüme tavsiyesi üretmeme.

## Başarı ölçütü

İlk pilotta hedef:
- gözlenen evre tarihleri ile PCSE evre tarihleri arasındaki fark,
- kendi fenoloji motorumuzla aynı saha gözlemlerine göre kıyas,
- hangi veri eksikliğinin sonucu ne kadar etkilediğinin açıklanabilirliği.

Tek bir demo sonucu ile mevcut `phenologyEngine.ts` değiştirilmez.

## Pusula bağlantısı

Örnek kanıt formatı:

```text
Model: PCSE/WOFOST
Gözlenen evre: Başaklanma — 12 Mayıs
Model evresi: Başaklanma — 15 Mayıs
Fark: 3 gün
Kullanılan sezon havası: tam / eksiksiz
Toprak verisi: laboratuvar / tahmini
```

Pusula sonuçları ancak gözlemle doğrulandıktan sonra 'model destekli' olarak işaretlenir.

## Sınır kalkınca ilk iş

1. Bir yıllık ürünlü test tarlası seç.
2. `crop-model-readiness` raporunu çalıştır.
3. Eksik alanları uygulama veri modelinde tamamla.
4. Aynı sezonu PCSE ve mevcut fenoloji motoruyla çalıştır.
5. Saha evre gözlemleriyle fark tablosu çıkar.
