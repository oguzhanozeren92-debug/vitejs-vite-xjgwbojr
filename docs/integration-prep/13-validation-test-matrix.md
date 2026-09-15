# 13 — Doğrulama / test matrisi

Amaç: entegrasyon günü “çalıştı” ile “doğru çalıştı” kavramlarını ayırmak.

## Ortak test sınıfları

Her motor en az şu testlerden geçer:

1. **happy path** — bütün girdiler var
2. **missing input** — kritik veri eksik
3. **stale data** — veri eski
4. **outlier input** — uç değer
5. **provider failure** — timeout/500/rate limit
6. **authorization** — başka kullanıcının fieldId'si
7. **cache invalidation** — ürün/toprak/geometri değişti
8. **version change** — model versiyonu değişti
9. **mobile offline/poor network** — UI düzgün fallback
10. **no fake values** — sonuç yoksa null/no-data

---

# pyfao56

## Fixture grupları

### A — Tam sulu yıllık ürün
- günlük hava
- ekim tarihi
- Kc/stage girdileri
- toprak su parametreleri
- gerçek sulama kayıtları

### B — Yağışlı / sulamasız
- irrigation_status = rainfed
- yağışlı dönem
- sulama işlemi yok

### C — Eksik hava
- bir gün radyasyon/ET referansı eksik

### D — Sulama kaydı geç girilmiş
- su dengesi değişimi kontrolü

## Kabul ölçümleri

- referans ET yönü ve büyüklüğü açıklanabilir
- eksik veri sessizce sıfıra dönüşmez
- sulama durumu `susuz` iken sulama emri üretilmez
- mevcut Irrigation Engine farkı loglanır
- fark toleransı verilere göre belirlenir; önceden rastgele % eşik konmaz

---

# PCSE / WOFOST

## Pilot ürün

İlk pilot çok yıllık bahçe değil, veri seti tamamlanabilen bir **yıllık ürün** olmalı.

Gerekli ground truth:
- ekim tarihi
- çıkış / belirgin evre gözlemleri
- çiçeklenme mümkünse
- olgunluk/hasat tarihi
- sezon sonu verim
- tarla operasyonları

## Testler

1. gerçek hava + gerçek ekim
2. ekim tarihi ±7 gün sensitivity
3. eksik toprak parametresi
4. hava verisinde boş gün
5. yanlış ürün çeşidi parametresi

## Kabul

Model yalnızca tarih üretmiş diye başarılı sayılmaz.

İlk hedef:
- fenoloji yönünün doğru olması,
- evre tarih hatasının ölçülmesi,
- yanlış/eksik girdide aşırı güven üretmemesi.

Verim doğrulaması daha sonraki aşamadır.

---

# AquaCrop

## Senaryolar

Aynı tarla/sezon için:

- S0: yağışa dayalı
- S1: mevcut çiftçi sulama kaydı
- S2: kontrollü alternatif sulama senaryosu

## Test amacı

Mutlak verim tahminiyle övünmek değil; modelin **senaryo sıralamasının** agronomik olarak mantıklı olup olmadığını görmek.

## Kabul

- aynı hava/toprak/ürün altında senaryolar tekrarlanabilir
- su miktarı arttıkça sonuç her durumda kör şekilde artmıyor; stres/aşırı su davranışı inceleniyor
- çok yıllık bahçe için hazırmış gibi kullanılmıyor
- gerçek sezon kaydı yoksa kullanıcıya yield tahmini gösterilmiyor

---

# AutoGeoBound

## Test seti

En az farklı sınır tipleri:
- tek parça düzenli tarla
- düzensiz tarla
- ağaçlık/bahçe
- yan yana benzer parseller
- yol/kanal sınırı
- küçük parsel
- bulut/gölge etkili görüntü

## Metrikler

- IoU
- area error %
- boundary distance
- kullanıcının edit sonrası değiştirdiği vertex/alan miktarı
- “hiç öneri verme” gereken başarısız vaka oranı

## UX kabulü

Model kötü sınır verdiğinde kullanıcı manuel çizime kolayca dönebilmeli.

Auto-save yasak.

---

# OpenAgri Pest/Disease risk

## Test kombinasyonları

- zararlı var + uygun GDD
- zararlı var + uygunsuz hava
- GBIF gözlemi var ama çok eski
- risk yüksek ama kullanıcı fotoğrafında belirti yok
- fotoğraf şüpheli + hava riski yüksek

## Kabul

- GBIF varlığı = tarlada zararlı var demek değildir
- risk model sonucu = teşhis değildir
- risk yüksek = otomatik pestisit önerisi değildir
- source date/evidence korunur

---

# Disease image model / AgML

## Test seti ayrımı

- public benchmark set
- TarlaPusula benzeri gerçek saha fotoğrafları
- sağlıklı yaprak
- hastalık
- zararlı hasarı
- besin noksanlığına benzeyen görüntü
- bulanık/karanlık/uzak fotoğraf
- modelde sınıfı olmayan vaka

## Ana metrikler

- macro F1
- per-class precision/recall
- confusion matrix
- high-confidence wrong prediction rate
- abstention/no-result kalitesi

## Production kapısı

Model bilmediği durumda “emin değilim / daha iyi fotoğraf çek” diyebilmelidir.

---

# OpenET

## Test

Aynı tarih aralığında:
- OpenET ET
- hava tabanlı ET0/ETc
- yağış
- kayıtlı sulama
- mümkünse toprak nemi

karşılaştırılır.

## Kabul

OpenET tek başına sulama kararının sahibi olmaz.

Önemli ölçüm:
- veri gecikmesi
- coverage
- Türkiye pilot alanında availability
- farklı model ürünleri varsa aralık

---

# Satellite / NDVI zaman serisi

## Regression set

Mevcut çalışan Copernicus hattı korunacağı için yeni EO aracı önce şu sonuçları bozmamalı:

- acquisition date
- valid pixel ratio
- NDVI mean/median
- trend direction
- no-data davranışı
- cloud filtering

Yeni çözüm aynı veriyi farklı hesaplıyorsa neden açıklanmalıdır.

---

# Pusula decision tests

Motor testinden ayrı yapılır.

Örnek birleşik senaryo:

```text
NDVI düşüyor
+ yağış yok
+ kök su açığı yükseliyor
+ ürün aktif gelişimde
+ sulama durumu sulu
=> sulama kontrol önerisi güçlü
```

Ama:

```text
NDVI düşüyor
+ ürün hasat edilmiş
=> su stresi önerisi verilmemeli
```

Pusula testleri özellikle stage error'ları yakalamalı.

---

# Test verisi gizliliği

GitHub'a gerçek kullanıcıya ait:
- koordinat,
- tarla poligonu,
- fotoğraf,
- özel operasyon geçmişi,
- kişi adı/kimliği

fixture olarak konmaz.

Test fixture'ları:
- sentetik,
- lisanslı açık veri,
- anonimleştirilmiş ve kullanıcıya geri bağlanamayan örnek

olmalıdır.

---

# Sonuç kaydı şablonu

Her pilot sonunda:

```text
Engine:
Version:
Fixture/field cohort:
Run count:
Success rate:
Failure modes:
Accuracy/quality metric:
Latency p50/p95:
Cost estimate:
License reviewed:
Privacy reviewed:
Decision: GO / HOLD / DROP
Reason:
```

Bu rapor olmadan pilot production'a ilerlemez.
