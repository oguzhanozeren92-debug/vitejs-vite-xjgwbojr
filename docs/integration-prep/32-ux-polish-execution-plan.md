# 32 — UX polish execution plan

Bu plan 2026-09-13 kullanıcı incelemesinde tespit edilen eksikleri, çalışan uygulamayı tek seferde riske atmadan küçük PR'lara böler.

## Kapsam

1. normal haritada görünür veri tarihi + gerçek pusula,
2. gerçek pusulanın görsel/işlevsel düzeltmesi,
3. alt nav Pusula AI'nın hub olarak yeniden kurulması,
4. Bildirimler'in placeholder'dan gerçek inbox'a dönüşmesi,
5. Ayarlar'ın placeholder'dan gerçek preference ekranına dönüşmesi,
6. uygulama açılışında dünya → tarla geçişi,
7. tarla değişiminde tarla → tarla uçuşu,
8. `Haritada gör` focus mode çakışmalarının temizlenmesi,
9. `Takvimime ekle` → Takvim → Bugün → Push zinciri,
10. bütün bu akışlarda Görevlerim/Pusula puanı kurallarının korunması.

---

# PR sırası

## TP-UX-100 — Map footer HUD + gerçek pusula

**Branch:** `feat/map-footer-hud`

### Değişecek
- `MapCompass.tsx`
- `MapDataDate.tsx/.css`
- `HomeMapEngine.tsx`
- map-first wrapper

### Yeni
- `MapFooterHud.tsx/.css`

### Bitti
Normal mapte veri tarihi + gerçek bearing pusulası okunaklı, altın vurgu yok, overlap yok.

### Bağımlılık
Yok. İlk yapılabilir iş.

---

## TP-UX-110 — Map launch + field switch transition

**Branch:** `feat/map-opening-transitions`

### Değişecek
- `mapOpening.ts`
- `openingTarget.ts`
- `HomeMapEngine.tsx`

### Yeni
- `mapTransitionController.ts`
- tests

### Bitti
Yeni page/app açılışında world/general → selected field; field değişiminde kısa regional → target geçişi.

### Kritik regresyon
- StrictMode double-play yok.
- same field rerender animasyon yok.
- old field data new field üstünde görünmüyor.

---

## TP-UX-120 — Haritada gör Focus Mode

**Branch:** `feat/map-focus-mode`

### Değişecek
- `HomeMapEngine.tsx`
- `HomeMapPusulaStrip.tsx`
- observation/map action entegrasyonları

### Yeni
- `features/home-map/focus/*`

### Bitti
`Haritada gör` sırasında ikon/text çakışması yok; hedef alan tek bakışta anlaşılır.

### Bağımlılık
TP-UX-100 HUD davranışını kullanır.

---

## TP-UX-130 — CalendarAction contract + Takvimime ekle

**Branch:** `feat/calendar-action-pipeline`

### Değişecek
- `useCalendarController.ts`
- calendar reminder UI
- `useTodayDecisions.ts`
- Pusula map strip/focus actions

### Yeni
- `calendarAction.ts`
- `calendarActionAdapter.ts`
- `AddToCalendarSheet.tsx/.css`

### Bitti
Pusula/map önerisi prefilled takvim sheet açar; kayıt Calendar'da ve due olduğunda Today'de görünür.

### Puan kuralı
Reminder create = 0P. Task completion varsa reward Task Engine üzerinden.

---

## TP-SHELL-140 — Notifications real inbox

**Branch:** `feat/notifications-inbox`

### Değişecek
- `App.tsx`
- `navigation.ts`
- `notificationQueue.ts`
- `GlobalPusulaBand.tsx`

### Yeni
- `pages/Notifications/*`
- inbox hook/row components

### Bitti
Placeholder yok; read/unread/filter/deep-link çalışan inbox var; Tasks tekrarlanmıyor.

---

## TP-SHELL-150 — Settings real screen

**Branch:** `feat/settings-screen`

### Değişecek
- `App.tsx`
- `navigation.ts`
- `GlobalPusulaBand.tsx`
- ilgili preference services

### Yeni
- `pages/Settings/*`
- `features/settings/*`

### Bitti
Hesap, notification, Pusula AI consent, theme/app ve privacy preference'ları gerçek UI ile çalışır.

### Güvenlik
Yeni server preference tablosu gerekirse user ownership RLS zorunlu; implementation günü Supabase docs/advisors doğrulanır.

---

## TP-AI-160 — Pusula AI Hub

**Branch:** `feat/pusula-ai-hub`

### Yeni
- `pages/PusulaAi/*`
- `features/pusula-ai/*`

### Değişecek
- `types/index.ts`
- `App.tsx`
- bottom navigation target
- `AiAnalysisScreen.tsx`
- `GlobalPusulaBand.tsx`

### Bitti
Bottom nav Pusula AI gerçek hub açar; photo analysis ayrı tool olur; overflow/giant content yok.

### Bağımlılık
Calendar Action ve Focus Mode contract'larını kullanabilmesi için TP-UX-120/130'dan sonra tercih edilir.

---

## TP-TASK-170 — Yeni UX'leri Task Engine'e bağla

**Branch:** `feat/tasks-cross-feature-actions`

### Kapsam
- missing field data -> task,
- focus photo request -> task,
- task -> optional calendar scheduling,
- task completion -> atomic Pusula reward,
- Task/Notification/Calendar dedupe.

### Bitti
Bir olayın hangi kanalda yaşayacağı deterministic ve duplicate'siz.

### Bağımlılık
`23`, `24`, `25` hazırlık dosyalarındaki Task Engine core implementation.

---

# Global screen policy

## GlobalPusulaBand

Yeni ekran matrisi uygulanır:

| Screen | Global auto guide | Küçük Pusula girişi |
| --- | --- | --- |
| Home | home-specific | evet |
| Pusula AI Hub | hayır | Hub kendi kimliğini taşır |
| Notifications | hayır | opsiyonel küçük |
| Settings | hayır | opsiyonel küçük |
| Calendar | gerekirse context-aware | küçük |
| Feature hubs | yalnız faydalı context varsa | küçük |

`screen !== home` gibi geniş bir kural artık yeterli değildir.

---

# Görev / puan / bildirim / takvim karar tablosu

| Olay | Task | Puan | Notification | Calendar |
| --- | ---: | ---: | ---: | ---: |
| Sulama durumu eksik | evet | completion'da | hayır | opsiyonel değil |
| Belirli alandan saha fotoğrafı lazım | evet | completion'da | hayır | kullanıcı sonra yapacaksa evet |
| Don riski | hayır | 0 | evet | kullanıcı isterse aksiyon ekler |
| Pusula yarın kontrol önerisi | hayır/kanıta göre task olabilir | task değilse 0 | bilgi gerekiyorsa | evet |
| Reminder oluştur | hayır | 0 | hayır | evet |
| Push izni aç | hayır | 0 | sistem state | hayır |
| AI consent aç | hayır | 0 | hayır | hayır |
| Map focus aç | hayır | 0 | hayır | hayır |
| Tarla değiştir | hayır | 0 | hayır | hayır |

---

# Mobil QA matrisi

Minimum kontrol:

- iPhone dar viewport ~320–375 px,
- 390–430 px modern iPhone,
- browser address bar görünür/gizli,
- PWA standalone varsa safe-area,
- light/dark mode,
- large text / text zoom,
- portrait orientation.

Haritada özellikle:

- top toolbar,
- right rail,
- focus header,
- map footer HUD,
- Pusula strip,
- bottom nav

aynı anda overlap testi yapılır.

---

# Veri doğruluğu / no-fake kuralı

Bu UX PR'ları mevcut kalıcı mimari kuralını değiştirmez:

- sahte tarih yok,
- sahte NDVI yok,
- sahte task completion yok,
- sahte önerilen calendar tarihi yok,
- API failure kullanıcı görevine çevrilmez,
- Pusula hesap motoru gibi davranmaz.

---

# Uygulama günü komut sırası

```text
TP-UX-100  map footer/date/compass
TP-UX-110  opening + field switch transition
TP-UX-120  focus mode
TP-UX-130  calendar action pipeline
TP-SHELL-140 notifications
TP-SHELL-150 settings
TP-AI-160 Pusula AI hub
TP-TASK-170 cross-feature task/points wiring
```

Task Engine core `23–25` henüz uygulanmamışsa TP-TASK-170 öncesi o epic tamamlanır.

---

# Final kabul

Bu epic tamamlandığında:

- harita normal halde tarih ve gerçek pusula taşır,
- harita açılışı atmosferli ama hızlıdır,
- field switching akıcıdır,
- `Haritada gör` okunabilir focus experience'dır,
- Pusula AI ayrı, düzgün bir merkezdir,
- Bildirimler ve Ayarlar placeholder değildir,
- planlanabilir öneri Calendar'a gider,
- zamanı gelince Today ve gerekirse push devreye girer,
- yapılacak veri işleri Task'ta yaşar,
- reward yalnız gerçek completion'da bir kez verilir.
