# P0 — pyfao56 entegrasyon hazırlık paketi

## Amaç

TarlaPusula'nın mevcut ET₀/Kc/su dengesi sonuçlarını bağımsız bir FAO-56 uygulamasıyla **doğrulamak**. pyfao56 ilk aşamada canlı sulama motorunun yerine geçmez.

Resmi repo: `kthorp/pyfao56`

## Bugünkü durum

- `tools/pyfao56-poc/` mevcut.
- Sentetik veriyle bağımsız çalışma var.
- `compare.py` aynı tarihli uygulama ET₀ + Kc verisiyle kıyas yapabiliyor.
- `prepare_open_meteo.py` önceden kaydedilmiş Open-Meteo yanıtını çevrimdışı dönüştürüyor.
- Canlı karar hattı şu an `src/features/irrigation/services/*` üzerinden kendi TypeScript motorumuzu kullanıyor.

## Lisans

GitHub repo metadata'sı lisansı otomatik olarak `NOASSERTION / Other` diye raporlasa da repository içindeki `LICENSE.md` açıkça şunu belirtir:

- ABD Hükümeti eseri olarak ABD içinde public domain,
- dünya çapında **CC0 1.0 Universal public-domain dedication**,
- ticari kullanım dahil kopyalama, değiştirme ve dağıtma serbest.

Bu nedenle pyfao56 kod lisansı P0 pilot için düşük sürtünmelidir. Yine de üçüncü taraf bağımlılıkların, hava/veri sağlayıcılarının ve kullanılan datasetlerin şartları ayrıca kontrol edilir.

## Girdi sözleşmesi

Minimum günlük veri:

```ts
type PyFao56DailyInput = {
  date: string;
  latitude: number;
  elevationM: number;
  windMeasurementHeightM: number;
  solarRadiationMjM2: number;
  tmaxC: number;
  tminC: number;
  rhMaxPct: number;
  rhMinPct: number;
  windMS: number;
  rainMm: number;
  appEt0Mm?: number;
  appKc?: number;
};
```

Gerçek sulama karşılaştırması için ek zorunlu bağlam:
- doğrulanmış sulama tarihi ve miktarı,
- başlangıç kök bölgesi su durumu,
- toprak su tutma parametreleri,
- kök derinliği,
- ürün evresi ve o güne ait Kc.

Eksik veri tahmin edilmez.

## Çıktı sözleşmesi

```ts
type PyFao56Result = {
  referenceEtMm: number | null;
  cropEtMm: number | null;
  rootZoneDepletionMm: number | null;
  comparison?: {
    appEt0Mm: number | null;
    deltaEt0Mm: number | null;
    appCropEtMm: number | null;
    deltaCropEtMm: number | null;
  };
};
```

Üst sarmalayıcı `EngineResult<PyFao56Result>` olacak.

## Adapter planı

Canlı uygulama zamanı geldiğinde:

```text
src/integrations/pyfao56/
  types.ts
  mapper.ts
  validation.ts
  adapter.ts

supabase/functions/pyfao56-bridge/
  index.ts
```

Python kodu React/Vite bundle'a eklenmez. `adapter.ts`, yalnızca güvenli backend endpoint'ine gider.

## Supabase/veri planı

Mevcut `field_irrigation_kc_snapshots` korunur. Gerekirse yeni tablo:

```text
irrigation_model_runs
- id
- user_id
- field_id
- engine
- engine_version
- date_from
- date_to
- input_hash
- status
- result_json
- evidence_json
- warnings_json
- created_at
```

Ham özel koordinat ve meteorolojik fixture repo içinde saklanmaz.

## Feature flag

Tercih edilen server-side master flag:

```text
ENABLE_PYFAO56=false
```

Frontend'e secret veya model kontrol credential'ı `VITE_*` ile verilmez. Gerekirse istemci yalnızca backend'den güvenli rollout durumunu öğrenir.

## Test senaryoları

1. Sentetik 7 gün — mevcut PoC regression.
2. Aynı Open-Meteo geçmiş veri seti — app ET₀ vs pyfao56 ET₀.
3. Kc var / yok davranışı.
4. Bir günlük veri eksik → `insufficient_data`.
5. Rüzgâr yüksekliği farklı → açık uyarı.
6. Gerçek sulama kaydı olmayan tarla → sulama tavsiyesi üretilmez.
7. Aynı input iki kez → aynı hesap sonucu / input hash.

## Kabul kriteri

İlk kabul **sulama miktarı doğruluğu değil**, referans ET hesaplarının metodolojik olarak açıklanabilir ve yeniden üretilebilir kıyasıdır.

Canlı sulama kararına bağlamak için ayrıca:
- en az bir tarla üzerinde doğrulanmış sulama kayıtları,
- eş tarihli gerçek hava serisi,
- ürün evresi/Kc geçmişi,
- toprak ve kök profili,
- sahadaki nem/uygulama sonucu
olmalıdır.

## Pusula bağlantısı

Pusula'ya doğrudan `Sulama yap` komutu verilmez. Önce kanıt:

```text
Kaynak: pyfao56 karşılaştırması
Tarih: YYYY-MM-DD
Uygulama ET₀: X mm
Referans ET₀: Y mm
Fark: Z mm
Not: iki farklı referans ET metodolojisi karşılaştırılıyor
```

## Sınır kalkınca ilk iş

1. Kullanılacak pyfao56 version/commit'i pinle ve CC0 lisans kaydını model registry'ye yaz.
2. Tek bir izinli test tarlasında aynı tarih/meteoroloji/Kc setini hazırla.
3. `compare.py` sonucunu mevcut Irrigation Engine çıktısıyla karşılaştır.
4. Farkın kaynağını belgelemeyen hiçbir sonucu canlı karara bağlama.
