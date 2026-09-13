# 15 — Model veri hazırlığı

Entegrasyonların en büyük riski kod değil, **eksik veya yanlış tarla verisi**. Bu dosya her motor için minimum veri sözleşmesini ve veri toplama yolunu tanımlar.

## Temel kural

Eksik veri:
- uydurulmaz,
- demo değerle doldurulmaz,
- eski veriden sessizce kopyalanmaz.

Motor `not_ready` / `no_data` döner ve Pusula kullanıcıdan yalnızca gerekli bir sonraki bilgiyi ister.

---

# Ortak Field Context

Tüm motorların mümkün olduğunca aynı normalize field context'i kullanması hedeflenir.

```ts
interface FieldModelContext {
  fieldId: string;
  geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  centroid?: { lat: number; lon: number };
  areaHa?: number;
  crop?: {
    name: string;
    variety?: string;
    plantingDate?: string;
    emergenceDate?: string;
    harvestDate?: string;
    seasonId?: string;
  };
  irrigation?: {
    status: 'irrigated' | 'rainfed' | 'partial';
    method?: string;
    lastIrrigationAt?: string;
    lastIrrigationMm?: number;
  };
  soil?: {
    texture?: string;
    ph?: number;
    organicMatterPct?: number;
    fieldCapacity?: number;
    wiltingPoint?: number;
    depthCm?: number;
  };
}
```

Bu interface üretim koduna birebir alınmak zorunda değildir; ortak veri hedefidir.

---

# pyfao56 minimum veri

## Zorunlu

- tarih aralığı
- günlük meteorolojik girdiler / doğrulanmış referans ET girdisi
- ürün Kc yaklaşımı
- ürün/gelişim evresi veya Kc zaman çizgisi
- toprak/kök bölgesi su kapasitesi için gerekli parametreler
- sulama durumu

## Sulama kararını doğrulamak için ayrıca

- gerçek sulama tarihleri
- mümkünse uygulanan mm veya hacim
- yağış
- mümkünse toprak nemi gözlemi

## Eksikse davranış

Sulama miktarı bilinmiyorsa model çalıştırılabilir araştırma çıktısı üretse bile **gerçek sulama doğrulaması yapıldı** denmez.

---

# PCSE minimum veri

İlk saha pilotu için:

- yıllık ürün
- ekim tarihi
- günlük hava serisi
- crop parameter set
- soil/site parametreleri
- sezon yönetim bilgisi

Doğrulama için:
- gerçek evre gözlemleri
- hasat tarihi
- sezon sonu verim

## Pusula veri toplama fırsatı

Pusula kullanıcıya aynı anda 10 soru sormaz.

Örnek sıra:
1. “Bu tarlaya bu sezon ne zaman ekim yaptın?”
2. daha sonra “Çıkış yaklaşık ne zaman başladı?”
3. sezon içinde kritik evre gözlemleri
4. hasatta gerçek tarih/verim

Bu kayıtlar gelecekte model kalibrasyonu için değerlidir.

---

# AquaCrop minimum veri

- günlük hava
- ürün parametreleri
- toprak profili
- başlangıç su durumu veya güvenilir başlangıç varsayımı
- ekim/hasat sezonu
- sulama senaryosu

Gerçek doğrulama için:
- gerçek sulama işlemleri
- sezon sonu verimi
- mümkünse dönemsel toprak nemi

## İlk kullanım sınırı

İlk pilot veri kalitesi yüksek bir yıllık üründe yapılır. Çok yıllık bahçe/çok karmaşık yönetim ilk pilot olmaz.

---

# AutoGeoBound minimum veri

- hedef nokta veya kaba kullanıcı alanı
- uygun tarihli ve yeterli çözünürlükte görüntü
- kullanıcı onayı

Doğrulama için:
- elle çizilmiş/referans polygon
- area
- mümkünse resmi/gerçek sınır kaynağı

## Kullanıcı akışı

1. kullanıcı yaklaşık tarlaya dokunur
2. sistem sınır önerir
3. TerraDraw ile düzenlenebilir
4. kullanıcı onaylar
5. ancak sonra kaydedilir

---

# Pest/Disease risk minimum veri

- hedef ürün
- hedef zararlı/hastalık modeli
- tarih
- hava serisi
- coğrafi bağlam

Güçlendirici sinyaller:
- GBIF geçmiş gözlemi
- kullanıcı fotoğrafı
- saha gözlemi
- fenoloji evresi
- geçmiş hastalık kaydı

GBIF tek başına varlık kanıtı değildir.

---

# Disease image model minimum veri

- görüntü
- hedef bitki/ürün bağlamı mümkünse
- görüntü kalite kontrolü

Güçlü doğrulama için:
- uzman etiketli saha fotoğrafları
- sağlıklı negatifler
- modelde olmayan sınıflar
- benzer belirti üreten besin/stres vakaları

---

# OpenET minimum veri

- field polygon
- date range
- kapsama uygun veri ürünü

Karşılaştırma için:
- aynı dönem hava tabanlı ET
- yağış
- gerçek sulama
- mümkünse toprak nemi

---

# Satellite anomaly minimum veri

- aynı geometri
- acquisition history
- yeterli geçerli piksel
- veri tarihi
- ürün sezon bağlamı

Fenoloji olmadan salt NDVI düşüşü “hastalık” veya “su stresi” diye etiketlenmez.

---

# Gerçek veri toplama kaynakları

Öncelik sırası:

1. kullanıcı doğrudan kaydı
2. uygulamadaki operasyon günlüğü
3. doğrulanmış laboratuvar/toprak analizi
4. trusted weather/satellite providers
5. sensör
6. tahmini/model türevi veri

Model türevi veri başka modelin “gerçek ground truth”u gibi kullanılmamalı.

---

# Veri tazeliği sınıfları

Öneri:

```ts
type Freshness = 'fresh' | 'aging' | 'stale' | 'unknown';
```

Metrik bazlı eşik farklıdır.

Örnek:
- hava tahmini: saat/gün
- uydu NDVI: birkaç gün/hafta
- toprak laboratuvarı: ay/sezon/yıl
- tarla sınırı: değişene kadar

Tek global “30 gün” kuralı her veri için kullanılmaz.

---

# Veri provenance

Her önemli değer mümkünse kaynak taşır:

```ts
interface ProvenancedValue<T> {
  value: T | null;
  source: string;
  observedAt?: string;
  fetchedAt?: string;
  method?: 'measured' | 'user_entered' | 'remote_sensing' | 'modeled';
}
```

Pusula evidence üretirken ölçülen ile modelleneni ayırt edebilir.

---

# Pusula eksik veri yönlendirmesi

Motor hazır değilse kullanıcıya teknik hata gösterilmez.

Örnek:

```text
“Sulama hesabını netleştirmek için son sulama tarihini bilmeme ihtiyacım var.”
```

veya

```text
“Bu sezonun gelişim tahmini için ekim tarihini ekler misin?”
```

Kurallar:
- tek seferde tek önemli eksik bilgi
- “Şimdi değil” seçeneği
- aynı soruyla sürekli rahatsız etmeme
- neden istendiğini kısa açıklama

---

# Veri readiness skoru

Her motor kendi readiness'ini hesaplamalı; uygulama geneli tek puan kullanılmaz.

Örnek:

```ts
interface ModelReadiness {
  engine: string;
  ready: boolean;
  score: number; // 0..1
  missingRequired: string[];
  missingOptional: string[];
  staleInputs: string[];
}
```

`score=0.8` olsa bile kritik zorunlu veri eksikse `ready=false` olabilir.

---

# İlk veri toplama önceliği

En yüksek model getirisi sağlayan kayıtlar:

1. doğru ekim/hasat tarihi
2. sulama durumu
3. gerçek sulama tarih/miktarı
4. tarla operasyon kayıtları
5. toprak analizi / toprak su parametreleri
6. kritik fenoloji gözlemleri
7. sezon sonu gerçek verim
8. sorunlu bölgeden tarihli fotoğraf

Bu veriler birden fazla motoru aynı anda güçlendirir.
