# 24 — Bildirim mi Görev mi? Routing politikası

Amaç: aynı şeyi hem Bildirimler'de hem Görevlerim'de yığmamak ve actionable işleri doğru yere taşımak.

## Ana ayrım

### Görev
Kullanıcının tamamlayabileceği ve **tamamlanma kriteri** bulunan iş.

Örnek:
- Sulama durumunu seç.
- Son sulama tarihini/miktarını kaydet.
- Zayıf alandan fotoğraf çek.
- Toprak analizi ekle.
- Ürün evresi gözlemini doğrula.
- Bugünkü planlı işlemi tamamla/kaydet.

### Bildirim
Kullanıcının bilmesi gereken olay/değişiklik. Mutlaka yapılacak iş değildir.

Örnek:
- Yarın don riski yükseldi.
- Yeni Sentinel-2 ölçümü geldi.
- Piyasa fiyatı anlamlı değişti.
- Bir analiz tamamlandı.
- Veri kaynağı geçici olarak alınamadı.

### Pusula önerisi
Birden fazla kanıtı yorumlayan tavsiye/insight. Her öneri görev değildir.

Örnek:
- “NDVI düşüyor, son sulama kaydın da eski; kuzeydoğuyu kontrol etmek iyi olabilir.”

Bu öneri kullanıcı aksiyonu gerektiriyorsa ayrı task üretilebilir:
- `Kuzeydoğu bölgesinden saha fotoğrafı ekle · +20P`

---

# Routing kararı

Her aday içerik şu sıradan geçer:

```text
1. Kullanıcıdan belirli bir eylem bekleniyor mu?
   hayır -> notification / Pusula insight
   evet -> 2

2. Eylemin doğrulanabilir completion kriteri var mı?
   hayır -> Pusula önerisi / action link
   evet -> task

3. Aynı olay acil bilgi de içeriyor mu?
   evet -> notification yalnız olayı bildirir, CTA task'a gider
   hayır -> yalnız task
```

## Duplicate yasağı

Aynı `sourceRef/eventKey` için:
- notification + task aynı metni iki kart halinde göstermez.
- acil notification gerekiyorsa kısa notification `Görevi aç` CTA'sı taşır.
- task asıl actionable kayıt olur.

---

# İlk routing matrisi

| Kaynak | Örnek | Hedef |
| --- | --- | --- |
| field completeness | sulama durumu eksik | TASK |
| field completeness | dikim yılı eksik | TASK |
| irrigation engine | karar için son sulama miktarı eksik | TASK |
| irrigation engine | bugün su stresi riski yüksek | PUSULA/NOTIFICATION; gerçek saha kontrolü gerekiyorsa TASK üret |
| phenology | ekim tarihi eksik | TASK |
| phenology | evre tahmini güncellendi | PUSULA / bilgi |
| satellite | yeni görüntü geldi | NOTIFICATION veya sessiz UI update |
| satellite | zayıf bölge fotoğrafla doğrulanmalı | TASK |
| satellite | NDVI 10 günde düştü | PUSULA; önem seviyesine göre NOTIFICATION |
| weather | don riski | NOTIFICATION; yapılacak koruma işlemi planlandıysa TASK |
| weather | uygun ilaçlama penceresi | PUSULA/NOTIFICATION; kullanıcının planındaki ilaçlama için TASK olabilir |
| soil | rapor yok | TASK (analiz ekle / laboratuvar sonucu gir) |
| soil | pH yüksek yorum | PUSULA |
| calendar | planlı iş bugün | TASK |
| calendar | gelecek hafta hatırlatma | NOTIFICATION; due olduğunda TASK |
| warehouse | stok azaldı | NOTIFICATION/PUSULA |
| warehouse | ürün bilgisi eksik | TASK yalnız tamamlanması gerçekten gerekliyse |
| admin/news | tarım gündemi | HABER, task değil |
| market | fiyat değişimi | NOTIFICATION/PUSULA, task değil |

---

# Notification Queue etkisi

Mevcut:

`src/features/notifications/services/notificationQueue.ts`

`HomeSystemNotification[]` localStorage kuyruğuna yazılıyor.

Yeni sistemde notification builder'lar önce semantic karar verir:

```ts
type ActionDisposition =
  | { kind: 'notification'; notification: HomeSystemNotification }
  | { kind: 'task'; candidate: TaskCandidate }
  | { kind: 'insight'; insight: PusulaInsight }
  | { kind: 'notification_with_task'; notification: HomeSystemNotification; task: TaskCandidate };
```

İlk refactor'da bütün notification sistemi yeniden yazılmaz. Sadece actionable eksik-data/due-work üreticileri task builder'a taşınır.

---

# Task ile notification arasındaki link

Acil olay + görev örneği:

```text
Notification:
“Bu gece don riski yüksek.”
CTA: “Görevi aç”

Task:
“Don önlemini kontrol et”
Reason: “Seçili tarla için gece minimumu kritik aralıkta.”
Reward: varsa yalnız doğrulanabilir bir saha/plan aksiyonunda; risk bildiriminin kendisi puan vermez.
```

Task id notification metadata'sında referans olabilir:

```ts
{
  taskId?: string;
  eventKey: string;
}
```

Notification okundu diye task tamamlanmaz.

---

# Missing-data özel kuralı

Eksik veri **bildirim değildir**.

Yanlış:

```text
Bildirimler:
- Sulama durumunu gir
- Ağaç boyunu gir
- Dikim tarihini gir
- Toprak analizini ekle
```

Doğru:

```text
Görevlerim:
- Sulama durumunu tamamla +20P
- Dikim tarihini tamamla +20P
- ...
```

Bildirimler ekranı bu yüzden daha temiz kalır.

Pusula gerekirse bir kez:

`Tarlan için 3 bilgi eksik. Görevlerim'e ekledim.`

diyebilir; her eksik alan ayrı notification olarak spam yapmaz.

---

# Task oluşturulmaması gereken durumlar

- veri aslında başka kaynaktan otomatik alınabiliyorsa kullanıcıdan isteme
- motor o veri olmadan da güvenle çalışıyorsa sırf puan için görev üretme
- aynı bilgiyi kullanıcı daha önce verdiyse tekrar isteme
- modelin belirsizliği kullanıcı tarafından çözülemeyecekse fake görev üretme
- external API failure'ını kullanıcı görevi yapma (`Uydu API'sini düzelt` gibi)
- haber/market content'i görev yapma

---

# Lifecycle

```text
source state changes
 -> semantic router
 -> task candidate / notification / insight
 -> dedupe by event/task key
 -> UI
```

Task tamamlanınca:
- task active listeden çıkar
- aynı source tekrar eksik değilse yeniden üretilmez
- buna bağlı eski “veri eksik” notification varsa resolve/remove edilir

Task `superseded` olursa:
- crop/field context değiştiği için gereksiz hale gelmiş olabilir
- puan verilmez
- kullanıcıya “başarısız görev” gibi gösterilmez

---

# Kabul kriterleri

- [ ] eksik veri notification spam'i yok
- [ ] tamamlanabilir işler Görevlerim'de
- [ ] salt bilgilendirme Bildirimler'de
- [ ] Pusula insight ile task aynı şey sayılmıyor
- [ ] acil bilgi + görev gerektiğinde notification task'a link verebiliyor
- [ ] notification okumak görevi tamamlamıyor
- [ ] aynı olay iki farklı kart olarak gereksiz tekrar etmiyor
- [ ] task tamamlanınca bağlı eksik-data uyarısı temizleniyor
