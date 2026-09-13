# P1 — Hastalık modeli / AgML / PlantVillage hazırlık paketi

## Amaç

TarlaPusula'nın mevcut görsel hastalık teşhis akışını doğrudan değiştirmek değil; açık tarım veri setleri ve modellerle **benchmark** yapmak, gerçekten daha iyi sonuç veren bir model varsa kontrollü olarak ikinci görüş/yerel model katmanı eklemek.

Ana aday: `Project-AgML/AgML`

## Repo doğrulaması

AgML aktif bir Python tarımsal ML framework'üdür. Tarımsal veri setleri, benchmarklar ve pretrained model erişimi sağlar. GitHub metadata'sında Apache-2.0 lisanslıdır.

## PlantVillage notu

`PlantVillage` tek bir yazılım paketi gibi ele alınmayacak. Kullanılan **dataset'in ve türevinin lisansı ayrıca doğrulanacak.** Bir dataset açıkça indirilebilir olsa bile ticari model eğitimi/yeniden dağıtım hakkı otomatik varsayılmaz.

## Ürün hedefi

Model şu üç rolden yalnızca biriyle alınabilir:

1. `benchmark_only` — mevcut teşhisi ölçmek için.
2. `second_opinion` — mevcut AI sonucuna ikinci skor/uyarı vermek için.
3. `primary_local_model` — ancak kapsamlı doğrulama sonrası.

İlk aşama yalnızca `benchmark_only`.

## Girdi sözleşmesi

```ts
type DiseaseImageInput = {
  imageId: string;
  crop?: string | null;
  organ?: 'leaf' | 'fruit' | 'stem' | 'whole_plant' | 'unknown';
  capturedAt?: string | null;
  fieldId?: string | null;
  imageQuality?: {
    blur?: number;
    brightness?: number;
    resolution?: { width: number; height: number };
  };
};
```

Modelin ürünü bilmediği durumda kullanıcıdan ürün seçimi istenebilir; model görüntüden ürün türünü uydurup kesin kabul etmez.

## Çıktı sözleşmesi

```ts
type DiseaseCandidate = {
  label: string;
  scientificName?: string | null;
  score: number;
};

type DiseaseModelResult = {
  cropDetected?: string | null;
  candidates: DiseaseCandidate[];
  outOfDistribution?: boolean;
  imageQualityWarning?: string | null;
  modelName: string;
  modelVersion?: string;
};
```

## Kritik güvenlik kuralı

Bir görüntü sınıflandırıcısının çıktısı **ilaç reçetesi değildir**. Kimyasal mücadele önerisi ayrı karar katmanında:
- ürün,
- gelişim evresi,
- ülke/ruhsat,
- etken madde,
- hasat aralığı,
- hava koşulları,
- depo envanteri
kontrollerinden geçmelidir.

## Benchmark veri seti

TarlaPusula için ayrı test seti gerekir:
- sağlıklı yapraklar,
- benzer görünümlü besin noksanlıkları,
- güneş yanığı / mekanik zarar,
- farklı hastalıklar,
- zararlı emgi/galeri belirtileri,
- bulanık/düşük ışık görüntüler,
- farklı telefon kameraları,
- Türkiye'de kullanılan çeşitlerden örnekler.

Dataset train/test sızıntısı olmamalı.

## Ölçütler

En az:
- top-1 accuracy,
- top-3 recall,
- macro F1,
- crop bazlı sensitivity,
- yanlış pozitif oranı,
- healthy vs diseased ayrımı,
- out-of-distribution reddetme başarısı,
- inference süresi,
- model boyutu
ölçülür.

Sadece genel accuracy ile karar verilmez.

## Adapter planı

```text
src/integrations/disease-model/
  types.ts
  adapter.ts
  validation.ts
  resultMapper.ts

supabase/functions/disease-model-bridge/
  index.ts
```

Model mobilde lokal çalışacaksa ayrıca ONNX/TFLite/CoreML dönüşüm hattı değerlendirilir. İlk aşamada bu karar verilmez.

## Feature flag

```text
VITE_ENABLE_AGML_DISEASE_MODEL=false
ENABLE_AGML_DISEASE_MODEL=false
```

## Mevcut AI ile karşılaştırma

Aynı görüntü için:
- mevcut TarlaPusula AI sonucu,
- aday açık model sonucu,
- mümkünse uzman/etiketli gerçek cevap
saklanır.

Değerlendirme tablosu:

```text
image_id | ground_truth | current_ai | candidate_model | current_correct | candidate_correct
```

## Pusula bağlantısı

Model canlıya geçerse kanıt dilinde:

```text
Görüntü modeli en güçlü aday olarak X'i işaretledi.
Bu yalnızca görsel bulgudur; kesin teşhis değildir.
```

Düşük skor veya OOD durumda:

```text
Bu fotoğraf güvenilir teşhis için yeterli görünmüyor. Daha yakın ve net bir yaprak fotoğrafı çek.
```

## Sınır kalkınca ilk iş

1. AgML içinde TarlaPusula ürün/hastalık kapsamına uygun dataset ve pretrained modelleri envanterle.
2. Her datasetin lisansını ayrı tabloya yaz.
3. 100+ etiketli açık/izinli görüntüden başlangıç benchmark seti oluştur.
4. Mevcut AI ile aynı görüntüler üzerinde kör karşılaştırma yap.
5. Aday model üstünlük göstermiyorsa uygulamaya ekleme.
