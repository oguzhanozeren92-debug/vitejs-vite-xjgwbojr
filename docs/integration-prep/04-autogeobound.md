# P1 — AutoGeoBound entegrasyon hazırlık paketi

## Amaç

Kullanıcı haritada tarlasını eklerken otomatik sınır **önerisi** sunmak. Model hiçbir zaman kullanıcı onayı olmadan parsel sınırını kaydetmez.

Resmi repo: `agstack/autogeobound`

## Repo doğrulaması

- Sahibi: AgStack Foundation
- Ana teknoloji: Jupyter Notebook / Python araştırma hattı
- Lisans: Apache-2.0
- Repo arşivlenmiş değil

Bu proje bir hazır mobil SDK gibi ele alınmayacak; önce model/iş akışı benchmarkı yapılacak.

## Kullanıcı akışı

1. Kullanıcı haritada yaklaşık konuma gelir.
2. `Otomatik sınır bul` seçeneği açılır.
3. Model 1 veya birkaç aday polygon üretir.
4. Aday sınır farklı renkte gösterilir.
5. Kullanıcı:
   - kabul eder,
   - noktaları düzeltir,
   - tamamen elle çizer.
6. Son onaydan sonra mevcut TarlaPusula alan kaydetme akışı çalışır.

Model sonucu doğrudan `fields.geometry` yerine yazılmaz.

## Girdi sözleşmesi

```ts
type AutoBoundaryInput = {
  center: { lat: number; lon: number };
  searchRadiusM: number;
  imageryDate?: string;
  imagerySource: string;
  hintPoint?: { lat: number; lon: number };
  existingApproxPolygon?: GeoJSON.Polygon;
};
```

## Çıktı sözleşmesi

```ts
type AutoBoundaryCandidate = {
  id: string;
  geometry: GeoJSON.Polygon;
  confidence?: number | null;
  imageryDate?: string | null;
  imagerySource: string;
  warnings: string[];
};
```

Birden fazla aday varsa skor sırasıyla gösterilebilir; fakat güven skoru modelin gerçekten kalibre edilmiş değeri değilse yüzde olarak kullanıcıya sunulmaz.

## Adapter planı

```text
src/integrations/autogeobound/
  types.ts
  validation.ts
  geometryMapper.ts
  adapter.ts

supabase/functions/auto-field-boundary/
  index.ts
```

Model ayrı işlem/servis olarak çalışır. Büyük model veya notebook kodu Vite bundle'a girmez.

## Mevcut sistemle bağlantı

TarlaPusula zaten:
- Mapbox/MapLibre,
- Turf,
- TerraDraw
kullanıyor.

Bu nedenle model yalnızca `polygon önerisi` verir; düzenleme, alan hesabı ve kullanıcı onayı mevcut harita araçlarımızla yapılır.

## Kalite ölçütleri

Benchmarkta en az:
- IoU (Intersection over Union),
- Boundary F1 / sınır sapması,
- alan farkı %, 
- kullanıcı düzeltmesi sonrası kaç nokta değişti,
- başarısız/kararsız örnek oranı
izlenir.

## Türkiye pilot seti

İlk benchmarkta farklı tipte alanlar olmalı:
- tek parça büyük tarla,
- küçük parseller,
- ağaçlık/bahçe,
- yol/kanal yanında tarla,
- komşu tarlaların bitişik olduğu örnek,
- bulut/gölge veya eski görüntü problemi olan örnek.

Gerçek kullanıcı tarlası test setine açık izin olmadan eklenmez.

## Feature flag

```text
VITE_ENABLE_AUTO_FIELD_BOUNDARY=false
ENABLE_AUTO_FIELD_BOUNDARY=false
```

## Fallback

Model:
- sınır bulamazsa,
- görüntü eskiyse,
- confidence güvenilmezse,
- polygon self-intersection üretirse

kullanıcı doğrudan mevcut elle çizim akışına döner.

## Güvenlik kontrolleri

- Polygon geçerli GeoJSON olmalı.
- Self-intersection reddedilir veya düzeltilir.
- Maksimum/minimum alan sınırı uygulanır.
- Çok uzak veya merkez noktayı içermeyen aday açık uyarı verir.
- Görüntü tarihi biliniyorsa kullanıcıya gösterilir.

## Pusula bağlantısı

Pusula burada karar verici değil, rehber olur:

```text
Bu sınır uydu görüntüsünden otomatik önerildi. Kaydetmeden önce kenarları kontrol et.
```

## Sınır kalkınca ilk iş

1. Resmi repo çalışma örneğini yerel PoC olarak yeniden üret.
2. 10-20 açık/izinli Türkiye örneği üzerinde benchmark seti oluştur.
3. Aday polygon çıktısını GeoJSON'a normalize et.
4. Mevcut TerraDraw düzenleme akışına mock adapter ile bağla.
5. Kalite düşükse canlı ürüne hiç alma; sadece araştırma olarak bırak.
