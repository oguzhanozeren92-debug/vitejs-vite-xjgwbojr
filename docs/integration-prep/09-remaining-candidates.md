# 09 — Kalan / belirsiz açık kaynak adayları

## Amaç

İlk açık kaynak listesinde adı geçen fakat net bir resmi repo, benzersiz ürün kimliği veya TarlaPusula'ya somut katkısı doğrulanmamış adayları temizlemek. Bu dosya özellikle yanlış projeyi entegre etmemek için tutulur.

---

## farmOS

Resmi repo: `farmOS/farmOS`

### Doğrulanan durum

- Aktif ve köklü bir proje.
- Web tabanlı çiftlik kayıt sistemi.
- PHP/Drupal tabanlı.
- Lisans: GPL-2.0.

### TarlaPusula kararı

**Durum: ARCHITECTURE / DATA-MODEL REFERENCE ONLY.**

farmOS komple sisteme alınmayacak ve kaynak kodu TarlaPusula'ya kopyalanmayacak.

Bize faydalı olabilecek fikir alanları:

- çiftlik varlığı / asset modeli,
- tarla işlem günlüğü,
- ekipman ve girdi kayıtları,
- sensör verisi ile faaliyet kaydı ilişkisi,
- audit/history yaklaşımı,
- sezonlar arası kayıt sürekliliği.

Neden full entegrasyon yok:

1. TarlaPusula'nın kendi Supabase veri modeli zaten var.
2. Drupal/PHP platformunu ayrıca işletmek gereksiz operasyon yükü.
3. GPL-2.0 kodunu uygulamaya doğrudan dahil etmek lisans açısından ayrıca değerlendirme gerektirir.
4. Bizim ihtiyacımız bir çiftlik ERP'si kurmak değil; mobil karar desteği ve saha asistanı.

---

## agro-gis

GitHub aramasında aynı/benzer isimli birden fazla bağımsız repo bulundu; örneğin `horazini/agro-gis` ve başka eski örnekler var.

### TarlaPusula kararı

**Durum: UNVERIFIED / HOLD.**

İlk listede hangi repo kastedildiği kesin değil. Exact repo + özellik + lisans üçlüsü doğrulanmadan hiçbir kod alınmaz.

Ayrıca TarlaPusula'da zaten:
- MapLibre/Mapbox tabanlı harita,
- polygon/parsel sistemi,
- TerraDraw,
- Turf.js,
- uydu katmanları,
- DEM/ERA5/Sentinel ekranları

bulunduğu için genel amaçlı bir GIS projesinin bize yeni değer katması düşük ihtimal.

### Yeniden açma şartı

Yalnızca aşağıdaki gibi spesifik yeni bir yetenek bulunursa tekrar incelenir:
- otomatik zoning,
- güçlü offline GIS,
- topoloji düzeltme,
- tarımsal spatial analysis algoritması,
- mevcut stack'te zor olan raster-vector analiz.

---

## YieldStack

GitHub repo aramasında tarımla ilgili, güvenilir ve açıkça bu isimde tekil bir upstream proje doğrulanamadı.

### TarlaPusula kararı

**Durum: REMOVE FROM ACTIVE QUEUE.**

Bu ad şimdilik entegrasyon planından çıkarılır. Eğer ileride exact URL veya proje sahibi bulunursa yeniden değerlendirilir.

Verim tahmini ihtiyacı ortadan kalkmıyor; sadece 'YieldStack' isimli doğrulanmamış bağımlılığa bağlanmıyoruz.

Verim/senaryo tarafında öncelikler:
1. PCSE/WOFOST doğrulaması,
2. AquaCrop sezon su/verim senaryosu,
3. gerçek kullanıcı hasat/verim kayıtları,
4. uydu zaman serisi + fenoloji sinyali,
5. ancak bunlardan sonra ML verim tahmini.

---

## AgriGuard

GitHub'da `AgriGuard` adıyla çok sayıda birbirinden bağımsız tarım/IoT/AI öğrenci veya demo projesi bulunuyor. Tek bir resmi upstream kimliği doğrulanmadı.

### TarlaPusula kararı

**Durum: REMOVE FROM ACTIVE QUEUE / NAME AMBIGUOUS.**

Exact repo doğrulanmadan hiçbir şey alınmaz.

Eğer ilk listede amaç 'tarla risk izleme' ise bu ihtiyaç zaten şu motorlara bölünmüş durumda:
- hava riskleri,
- uydu değişim tespiti,
- GBIF zararlı gözlemleri,
- hastalık/zararlı risk modeli,
- fotoğraf AI,
- Pusula karar katmanı.

Dolayısıyla genel bir AgriGuard demosunu bağlamak yerine kendi uzman motorlarımızı birleştirmek daha temizdir.

---

## Crop AI / CropGuard benzeri demolar

İlk plandaki bu başlıklar bir üretim bağımlılığı değil, UX/model fikir havuzuydu.

### TarlaPusula kararı

**Durum: INSPIRATION ONLY.**

Kullanılabilecek şeyler:
- kamera akışı UX'i,
- confidence gösterimi,
- hastalık sonuç ekranı yapısı,
- açıklanabilirlik kartları,
- kullanıcıdan ikinci fotoğraf isteme akışı.

Kullanılmayacak şeyler:
- lisansı belirsiz model ağırlıkları,
- doğrulanmamış hastalık sınıfları,
- sadece demo için hazırlanmış sahte confidence,
- backend anahtarlarını istemciye koyan örnek kodlar,
- kaynak/etiket kalitesi bilinmeyen datasetler.

---

## PlantVillage

PlantVillage tek başına 'uygulamaya eklenecek paket' gibi ele alınmayacak; dataset/model değerlendirme girdisi olarak görülecek.

### Karar

**Durum: DATASET BENCHMARK CANDIDATE.**

`05-disease-models.md` içindeki benchmark planı geçerlidir.

Önemli risk: laboratuvar/temiz arka planlı yaprak görüntülerinde iyi sonuç alan bir model gerçek tarla fotoğrafında aynı performansı vermeyebilir. Bu nedenle gerçek saha test seti olmadan model canlıya geçmez.

---

## geemap

Detay: `07-satellite-data-stack.md`.

**Durum: R&D TOOL.**

Production dependency değil; Earth Engine araştırması ve notebook prototipleme için kullanılabilir.

---

## Genel temizlik kararı

Aktif entegrasyon kuyruğunda yalnızca exact upstream'i ve gerçek katkısı bilinen projeler tutulur.

### Aktif / doğrulanmış upstream'ler

- pyfao56
- PCSE/WOFOST
- AquaCrop-OSPy
- AutoGeoBound
- AgML
- FarmVibes.AI
- GBIF (zaten live)
- OpenAgri Pest&Disease (benchmark)
- OpenAgri IrrigationManagement (benchmark)
- AgStack Asset Registry (research)
- sentinelhub-py / eo-learn (gerektiğinde research)
- OpenET (ET validation research)

### Aktif kuyruğun dışında

- YieldStack — exact upstream yok
- AgriGuard — isim belirsiz
- agro-gis — exact proje/fayda belirsiz
- Crop AI / CropGuard demos — fikir referansı
- farmOS — kod bağımlılığı değil, veri modeli referansı

## Yeni repo kabul kuralı

Bundan sonra listeye yeni GitHub projesi eklenmeden şu beş satır doldurulmalıdır:

```text
Exact upstream URL:
License:
TarlaPusula'da çözdüğü tek cümlelik problem:
Mevcut sistemimizle çakışıyor mu?:
Başarı metriği:
```

Bu beş alan dolmadan proje 'planlandı' sayılmaz.
