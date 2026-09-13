# 28 — Bildirimler ve Ayarlar: placeholder'dan gerçek sayfaya

## Mevcut kök neden

`notificationsHub` ve `settingsHub` Screen olarak tanımlı; ancak `BASE_PLACEHOLDER_META` içinde bulunuyor ve App bunları `PlaceholderScreen` ile açıyor. Bu yüzden mobilde:

- `HAZIRLANIYOR` iskeleti,
- gerçek işlevi olmayan kartlar,
- eski placeholder CSS,
- üstüne eklenen Global Pusula UI

birleşerek kırık görüntü oluşturuyor.

Ürün kararı: bu iki ekran **placeholder olarak kalmayacak**.

---

# A — Bildirimler

## Amaç

Bildirimler yalnız kullanıcının bilmesi gereken olayları gösterir. Kullanıcının yapacağı işler `Görevlerim`e gider.

### Bildirim örnekleri

- don riski oluştu,
- kuvvetli rüzgâr bekleniyor,
- yeni uydu verisi geldi,
- fiyat alarmı tetiklendi,
- destek/mevzuat değişikliği,
- planlanmış hatırlatma zamanı yaklaştı.

### Bildirim olmayanlar

- sulama durumunu gir,
- toprak analizi ekle,
- fotoğraf çek,
- ekim tarihini tamamla.

Bunlar `Görevlerim`dir.

## Ekran yapısı

```text
Bildirimler
[Tümü] [Okunmamış] [Tarla] [Hava] [Fiyat]

Bugün
• Dağlık · Don riski                14:10
  Gece sıcaklığı 2°C'ye düşebilir.
  [Hava durumunu aç]

Dün
• Yeni uydu görüntüsü hazır
  12 Eylül tarihli NDVI görüntüsü geldi.
  [Haritada aç]
```

### Davranış

- okundu/okunmadı,
- ilgili tarlaya göre filtre,
- kaynak/severity etiketi,
- doğru deep-link,
- `Tümünü okundu işaretle`,
- boş durum.

Task aynı olay için ikinci kez Bildirimler'de kopyalanmaz.

## Veri planı

Mevcut `notificationQueue.ts` localStorage kuyruğu geçiş dönemi için kullanılabilir; uzun vadede giriş yapan kullanıcıda server persistence tercih edilir.

Önerilen domain:

```ts
NotificationItem {
  id
  userId
  fieldId?
  source
  severity
  title
  body
  target
  createdAt
  readAt?
  dedupeKey
}
```

Server tablo açılırsa RLS kullanıcı sahipliğiyle sınırlandırılır; implementasyon günü güncel Supabase docs/advisors tekrar kontrol edilir.

---

# B — Ayarlar

## Amaç

Ayarlar sade ve gerçekten çalışan bir tercih merkezi olacak.

## Bölümler

### Hesap
- profil bilgisi,
- plan/üyelik,
- oturum işlemleri.

### Bildirim tercihleri
- kritik hava uyarıları,
- tarla/uydu uyarıları,
- fiyat alarmları,
- takvim hatırlatmaları,
- telefon push durumu.

### Pusula AI ve veri kullanımı
- özellik bazlı AI kullanım izinleri,
- hangi veri grubunun Pusula bağlamında kullanılabileceği,
- kısa açıklama + açık/kapalı durum.

Kalıcı ürün kuralı: kullanıcı bir özelliğin AI kullanımını kapatırsa o veri AI'a gönderilmez.

### Uygulama
- Gece / Gündüz tema,
- dil geleceğe hazır,
- birim tercihleri gerekiyorsa,
- harita animasyonlarını azalt / sistem `prefers-reduced-motion` desteği.

### Konum ve gizlilik
- konum izni durumu,
- veri/gizlilik açıklamaları,
- gerekli hesap/veri işlemleri.

## Puan / görev kuralı

Ayarlar ekranında kullanıcıyı mahremiyet izni vermeye zorlayan gamification yapılmaz.

- push aç: **puan yok**,
- AI consent aç: **puan yok**,
- konum izni ver: **puan yok**.

Eksik agronomik veriler Ayarlar'a değil Görevlerim'e gider ve uygun olanlar puanlı olabilir.

Bu ayrım kullanıcı rızasının ödülle satın alınmaması için bilinçli üründür.

---

# Global Pusula ekran politikası

Settings ve Notifications üzerinde dev Pusula görseli çıkmayacak.

`GlobalPusulaBand` için ekran matrisi:

- `settingsHub`: auto guide/modal **kapalı**.
- `notificationsHub`: auto guide/modal **kapalı**.
- gerekirse yalnız app-shell header içindeki küçük Pusula giriş noktası.

Global yardımcı içerik ekrana göre kontrollü açılır; `screen !== home` olmak tek başına yeterli koşul değildir.

---

# Tasarım

- merkezi Obsidian/Light theme tokenları.
- placeholder'ın eski inline stilleri kullanılmaz.
- iOS safe-area.
- dokunma hedefleri min ~44 px.
- fontlar diğer modern TarlaPusula ekranlarıyla aynı.
- dev `HAZIRLANIYOR`, sıra numarası 01/02/03 ve `Yakında` kartları kalkar.

# Dosya planı

Yeni:

```text
src/pages/Notifications/NotificationsScreen.tsx
src/pages/Notifications/NotificationsScreen.css
src/features/notifications/hooks/useNotificationsInbox.ts
src/features/notifications/components/NotificationRow.tsx
src/pages/Settings/SettingsScreen.tsx
src/pages/Settings/SettingsScreen.css
src/features/settings/hooks/useSettings.ts
src/features/settings/types.ts
```

Değişecek:

```text
src/App.tsx
src/data/navigation.ts
src/components/GlobalPusulaBand.tsx
src/features/notifications/services/notificationQueue.ts
```

`notificationsHub` ve `settingsHub`, `BASE_PLACEHOLDER_META` active placeholder routing'den çıkarılır.

# Kabul kriterleri

- [ ] Bildirimler gerçek inbox olarak açılır; placeholder görünmez.
- [ ] Ayarlar gerçek çalışan preference ekranı olarak açılır.
- [ ] global Pusula görseli içerik üstüne binmez.
- [ ] görevler Bildirimler'de tekrar edilmez.
- [ ] notification deep-link doğru target'a gider.
- [ ] bildirim tercihleri push consent durumunu doğru yansıtır.
- [ ] AI toggles gerçekten AI context gönderimini etkileyen service sınırına bağlıdır.
- [ ] consent/permission için Pusula puanı verilmez.
- [ ] light/dark tasarım aynı yapıyı korur.

# Bitti tanımı

Kullanıcı Bildirimler'e girdiğinde **ne oldu?**, Ayarlar'a girdiğinde **neyi değiştirebilirim?** sorusunun cevabını gerçek işlevlerle alıyorsa tamamdır.
