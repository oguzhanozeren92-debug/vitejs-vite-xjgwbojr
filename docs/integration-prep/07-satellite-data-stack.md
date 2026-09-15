# 07 — Uydu / Earth Observation entegrasyon hazırlığı

## Amaç

TarlaPusula'da halihazırda çalışan Copernicus tabanlı uydu akışını bozmadan, ek GitHub araçlarının gerçekten yeni değer sağlayıp sağlamadığını önceden değerlendirmek. Temel ilke: çalışan Sentinel-2/NDVI hattını sırf popüler bir kütüphane var diye değiştirmemek.

## Mevcut TarlaPusula durumu

- Sentinel-2 L2A tabanlı NDVI zaman serisi zaten mevcut.
- Bulut/gölge/kar ve geçersiz piksel temizliği mevcut uydu işlevinde yapılıyor.
- `src/features/satellite/` altında NDVI zaman serisi, uydu karar katmanı ve fusion servisleri bulunuyor.
- `supabase/functions/satellite-field-analysis/` mevcut backend hattının bir parçası.
- Veri tarihi / geçmiş görüntüler için ayrı `map-data` feature yapısı var.

Bu nedenle aşağıdaki araçların hiçbiri varsayılan olarak `LIVE` yapılmayacak.

---

## Aday 1 — sentinelhub-py

Repo: `sentinel-hub/sentinelhub-py`

### Doğrulanan bilgiler

- Python kütüphanesi.
- Sentinel Hub servislerinden görüntü indirme ve işleme amacı taşıyor.
- Lisans: MIT.
- Proje güncel ve aktif.

### TarlaPusula kararı

**Durum: HOLD / sadece kıyaslama için hazır.**

Şu an Copernicus Data Space ile doğrudan çalışan hattımız varken yeni bir sağlayıcı bağımlılığı ve Python servis katmanı eklemek gereksiz olabilir.

### Yeniden değerlendirme tetikleyicileri

Aşağıdakilerden biri ortaya çıkarsa pilot açılır:

1. Copernicus mevcut endpoint ile istediğimiz bant/ürün/hız sağlanamıyorsa.
2. Çoklu Sentinel ürünü aynı workflow içinde toplamak ciddi şekilde kolaylaşıyorsa.
3. Batch processing maliyeti ve operasyonu mevcut çözümden daha iyi oluyorsa.
4. Sentinel Hub tarafında ihtiyacımız olan özel veri katmanı yalnızca oradan pratik biçimde alınabiliyorsa.

### Pilot adapter sözleşmesi

`SatelliteProviderAdapter`

Input:
- field polygon (GeoJSON)
- date range
- layer/index
- max cloud percentage
- spatial resolution

Output:
- acquisition date
- valid pixel ratio
- cloud ratio
- field mean/median
- optional raster/tile reference
- source/provider
- quality flags

Kural: UI ve Pusula, sağlayıcıya özel cevabı asla doğrudan tüketmez.

---

## Aday 2 — eo-learn

Repo: `sentinel-hub/eo-learn`

### Doğrulanan bilgiler

- Earth observation + machine learning workflow framework'ü.
- Python.
- Lisans: MIT.
- Zaman serisi ve EO işleme senaryolarına uygun.

### TarlaPusula kararı

**Durum: RESEARCH / HOLD.**

Tek başına kullanıcıya özellik değildir. Değer üretmesi gereken yerler:

- uzun dönem NDVI/NDRE zaman serisi normalizasyonu,
- değişim noktası / anomali çıkarımı,
- çok tarihli feature engineering,
- segmentation/model ön işleme pipeline'ı.

### Kabul kriteri

Ancak kendi TypeScript + Edge Function hattımıza göre şu alanlardan en az birinde ölçülebilir üstünlük sağlarsa devam eder:

- daha iyi anomali doğruluğu,
- daha az kod/operasyon yükü,
- çoklu sensör birleştirmede belirgin kolaylık,
- daha düşük toplam çalışma maliyeti.

---

## Aday 3 — Sentinel Hub Custom Scripts

Repo: `sentinel-hub/custom-scripts`

### Doğrulanan bilgiler

- Sentinel Hub için JavaScript evalscript arşivi.
- Lisans: CC-BY-SA-4.0.

### TarlaPusula kararı

**Durum: REFERENCE ONLY.**

Bu repo doğrudan kopyalanıp uygulamaya gömülmeyecek. Özellikle lisans ve attribution/share-alike etkisi nedeniyle her script ayrıca incelenecek.

Kullanım biçimi:
- indeks formüllerini ve görselleştirme yaklaşımlarını referans almak,
- NDVI/NDRE/SAVI/GNDVI renk skalalarını kıyaslamak,
- mevcut hesaplarımızı formül testiyle doğrulamak.

Kopyalama yapılacaksa ilgili scriptin lisans şartı ayrıca kaydedilir.

---

## Aday 4 — OpenET

### Doğrulanan coğrafi uygunluk

OpenET'in resmi yayınları platformu ve tarla düzeyi veri erişimini **Batı Amerika Birleşik Devletleri** bağlamında tanımlıyor; OpenET materyallerinde 17 batı eyaletindeki tarlalar ve Batı ABD su yönetimi temel kullanım alanı olarak yer alıyor.

TarlaPusula'nın hedef sahaları Türkiye'de olduğu için OpenET'i bugün canlı ET sağlayıcısı olarak planlamak doğru değildir.

### TarlaPusula kararı

**Durum: REFERENCE / DROP FROM ACTIVE IMPLEMENTATION QUEUE.**

OpenET:
- ET metodolojisi,
- ensemble yaklaşımı,
- uydu tabanlı tüketim suyu ölçümü,
- doğrulama/accuracy çalışma tasarımı

için güçlü bir referans olabilir; fakat Türkiye tarlalarında kapsama doğrulanmadan adapter yazmak gereksizdir.

### Yeniden açma şartı

Yalnızca OpenET resmi olarak Türkiye/ilgili global kapsama sunarsa veya açıkça Türkiye'de kullanılabilir aynı veri/model servisi ortaya çıkarsa yeniden değerlendirilir.

Bu durumda önerilen normalize çıktı:

```ts
interface RemoteEtObservation {
  fieldId: string;
  startDate: string;
  endDate: string;
  etMm: number | null;
  source: string;
  model?: string;
  coverage?: number;
  qualityFlags: string[];
}
```

Ancak şimdilik `openet.adapter.ts` oluşturulmayacak ve `ENABLE_OPENET` uygulama backlog'unda aktif iş değildir.

---

## Aday 5 — geemap

Repo: `gee-community/geemap`

### Doğrulanan bilgiler

- Google Earth Engine üzerinde interaktif geospatial analiz için Python paketi.
- Lisans: MIT.
- Çok geniş raster / GEE yardımcı araç seti sunuyor.

### TarlaPusula kararı

**Durum: R&D TOOL, production dependency değil.**

Bize en çok notebook/araştırma ortamında yarar sağlar:

- yeni veri setlerini hızla incelemek,
- raster katman prototipi yapmak,
- zaman serilerini görsel kıyaslamak,
- Earth Engine veri kataloğunda fizibilite yapmak.

Mobil uygulamanın runtime'ına veya Vercel ön yüzüne eklenmez. Google Earth Engine kullanım şartları ve hesap/kota yapısı ayrı bir operasyon katmanıdır.

---

## Uydu katmanları için tek otorite kuralı

Her metrik için aynı anda birden fazla 'ana gerçek' üretmeyeceğiz.

Örnek:

- NDVI ana kaynak: mevcut Copernicus pipeline.
- ET/su dengesi: mevcut hava + Irrigation Engine + pyfao56 validation hattı.
- OpenET: Türkiye için şu an canlı kaynak değil; metodoloji referansı.
- Pusula AI: bunların sonuçlarını açıklar, sayıyı kendi üretmez.

## Ortak kalite şeması

Tüm EO adapter'ları şu kalite alanlarını döndürmeye çalışmalı:

```ts
interface SpatialQuality {
  acquisitionDate: string | null;
  validPixelRatio: number | null;
  cloudRatio: number | null;
  spatialResolutionM: number | null;
  sourceAgeDays: number | null;
  qualityFlags: string[];
}
```

## Yapılmayacaklar

- Basemap görüntüsünün görünümünden ürün gelişim evresi çıkarmak.
- Veri tarihi bilinmeden 'güncel uydu' demek.
- Bulutlu/az pikselli gözlemi Pusula önerisine güçlü kanıt olarak vermek.
- Aynı NDVI için Copernicus + Sentinel Hub + GEE sonuçlarını kullanıcıya üç ayrı gerçek gibi göstermek.
- Notebook prototipini üretim servisi sanmak.
- Türkiye kapsamı olmayan veri sağlayıcısına sırf popüler diye adapter yazmak.

## Sınır kalkınca uygulanacak sıra

1. Mevcut uydu hattına ortak `SpatialQuality` normalize alanlarını ekle.
2. eo-learn'i yalnızca zaman serisi/anomali benchmarkı gerçekten gerekirse dene.
3. sentinelhub-py'yi ancak mevcut Copernicus hattının somut açığı oluşursa dene.
4. geemap'i R&D notebook aracı olarak tut.
5. OpenET'i yalnız metodoloji/accuracy referansı olarak izle; Türkiye resmi kapsaması ortaya çıkmadan entegrasyon işi açma.
