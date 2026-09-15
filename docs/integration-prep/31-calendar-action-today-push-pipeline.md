# 31 — `Takvimime ekle` → Takvim → Bugün → telefon bildirimi

## Amaç

TarlaPusula bir öneriyi zamana bağlayabiliyorsa kullanıcı tek dokunuşla kendi planına ekleyebilmeli. O gün geldiğinde iş `Bugün` alanında görünmeli; kullanıcı isterse telefon push bildirimi almalı.

Bu yeni bir ikinci takvim sistemi değildir. Mevcut `useCalendarController`, `calendar_reminders`, service worker/push altyapısı ve `useTodayDecisions` üzerine kurulur.

## Mevcut hazır altyapı

Repo bugün zaten şunlara sahip:

- `CalendarReminder` domain tipi,
- `calendar_reminders` okuma/yazma/tamamlama,
- reminder date/time,
- `notification_enabled`, timezone,
- `push_subscriptions`,
- service worker subscription,
- `send-due-reminders` function çağrısı,
- `useTodayDecisions` içinde `nextCalendarItem` adayını `TAKVİM` olarak gösterme.

Eksik parça: diğer özelliklerden standardize bir **prefilled calendar action** üretme sözleşmesi.

## Yeni ortak contract

```ts
type CalendarActionSource =
  | 'pusula'
  | 'weather'
  | 'irrigation'
  | 'pest_risk'
  | 'map_focus'
  | 'task'
  | 'manual';

type CalendarActionDraft = {
  fieldId: string;
  fieldName: string;
  title: string;
  reminderType: string;
  suggestedDate: string;
  suggestedTime?: string | null;
  notes?: string | null;
  source: CalendarActionSource;
  sourceId?: string | null;
  evidenceDate?: string | null;
  allowPush: boolean;
};
```

UI hiçbir feature'ın özel objesini takvime doğrudan yazmaz. Önce bu draft'a normalize eder.

## `Takvimime ekle` nerelerde görünür?

Yalnız aksiyon gerçekten zamanlanabiliyorsa:

- Pusula saha kontrolü,
- hava uygunluğu/ilaçlama penceresi,
- sulama kontrolü,
- zararlı riskinde yeniden gözlem,
- haritadaki zayıf alanı belirli tarihte kontrol,
- bir görevi daha sonra yapma.

Sadece bilgi veren kartta buton gösterilmez.

## Ekleme akışı

```text
[Takvimime ekle]
      ↓
Prefilled bottom sheet
- tarla
- iş
- önerilen gün
- saat (opsiyonel)
- not
- telefon hatırlatması toggle
      ↓
[KAYDET]
      ↓
calendar_reminders
```

Kullanıcı önerilen tarihi mutlaka değiştirebilir. AI tarihi sessizce zorunlu kılmaz.

## Bugün listesi

Takvim öğesi geldiği gün:

- `Bugün ne yapacağım?` adaylarına girer,
- zamanı varsa saat gösterilir,
- tamamlandıysa aktif listeden çıkar,
- eski/gecikmiş işler `Gecikti` etiketiyle uygun öncelikte gösterilebilir.

Mevcut `useTodayDecisions` tek `nextCalendarItem` alıyor. Implementation sırasında hedef:

```text
calendar due today / overdue
  -> Today candidates
  -> priority + dedupe
  -> max görünür öğe kurallarına göre seç
```

Görevlerim ve Takvim aynı şey değildir:

- `Görevlerim`: sistemin kullanıcıdan ihtiyaç duyduğu doğrulanabilir iş/veri.
- `Takvim`: kullanıcının ne zaman yapacağını planladığı iş.

Bir Task takvime planlanabilir; task tamamlanana kadar Task Engine'de aktif kalır.

## Pusula puanı

### Puan verilmez

- yalnız `Takvimime ekle` butonuna basmak,
- reminder oluşturmak,
- push açmak,
- reminder'ı silip tekrar eklemek.

### Puan verilebilir

Takvim öğesi bir Task Engine göreviyle bağlıysa ve görevin gerçek completion kriteri karşılandıysa:

```text
calendar reminder
   -> user completes real feature action
   -> task completion server validation
   -> tp_award_points(dedupeKey)
```

Örn: `Batı bölümünden saha fotoğrafı çek +20P` takvime alınabilir; puan takvime eklenince değil, doğru alan için fotoğraf kaydedildiğinde verilir.

## Push bildirimi

- kullanıcı izni olmadan push yok.
- Push consent açmak puan vermez.
- reminder'da `notification_enabled` kullanıcı tarafından kontrol edilebilir.
- server due-reminder job aynı reminder için duplicate push göndermemeli.
- timezone kullanıcı/tarla bağlamında doğru tutulmalı; Türkiye için default fallback `Europe/Istanbul`, ancak runtime timezone esas alınır.

Örnek push:

```text
TarlaPusula · Dağlık
Batı bölümünü kontrol et
Bugün 09:00 için planlamıştın.
```

Tap -> doğru calendar/task/map target'a deep-link.

## Bildirimler ekranıyla ilişki

Push gönderilmiş olması inbox'ta notification event oluşturabilir; fakat calendar task'ın kendisi Bildirimler listesine sürekli kopyalanmaz.

Önerilen ayrım:

- Calendar = plan,
- Today = bugünkü özet,
- Push = zamanı gelince dikkat çekme,
- Notifications Inbox = oluşmuş olay/uyarı geçmişi,
- Tasks = doğrulanabilir yapılacak iş.

## Uygun tarih üretme güvenliği

Pusula/engine tarih öneriyorsa evidence olmalıdır.

Örn:
- `yağıştan 24 saat sonra kontrol et`,
- `yarın 06:00–09:00 rüzgâr düşük`,
- `7 gün sonra aynı noktadan fotoğraf çek`.

Kanıt yoksa default bugün/yarın gibi sahte agronomik tarih üretmek yerine calendar sheet kullanıcının tarih seçmesini ister.

## Dosya planı

Yeni:

```text
src/features/calendar/types/calendarAction.ts
src/features/calendar/services/calendarActionAdapter.ts
src/features/calendar/components/AddToCalendarSheet.tsx
src/features/calendar/components/AddToCalendarSheet.css
src/features/calendar/hooks/useCalendarAction.ts
```

Değişecek:

```text
src/features/calendar/hooks/useCalendarController.ts
src/features/calendar/hooks/useNextCalendarItem.ts
src/features/today/hooks/useTodayDecisions.ts
src/features/today/components/HomeTodayCard.tsx
src/features/pusula/components/HomeMapPusulaStrip.tsx
src/pages/PusulaAi/PusulaAiScreen.tsx
src/features/home-map/focus/MapFocusActions.tsx
src/features/weather/* uygun aksiyon yüzeyleri
src/features/irrigation/* uygun aksiyon yüzeyleri
```

Server tarafında mevcut due reminder mekanizması audit edilir; yeni tablo/RPC gerekiyorsa RLS + ownership + idempotency doğrulanır.

## Kabul kriterleri

- [ ] uygun Pusula aksiyonunda `Takvimime ekle` görünür.
- [ ] sheet doğru tarla ve title ile prefilled açılır.
- [ ] kullanıcı tarih/saat değiştirip kaydedebilir.
- [ ] kayıt mevcut takvim ekranında görünür.
- [ ] geldiği gün Today listesine girer.
- [ ] tamamlanan reminder Today aktif listesinden çıkar.
- [ ] push izni açık ve reminder enabled ise zamanı gelince notification pipeline'a girer.
- [ ] push/consent için puan verilmez.
- [ ] task bağlı reminder'da puan gerçek task completion'da bir kez verilir.
- [ ] aynı reminder duplicate push/duplicate point üretmez.
- [ ] deep-link doğru tarla/özellik ekranını açar.

## Bitti tanımı

Kullanıcı Pusula'nın bir önerisini **tek akışla planlayabiliyor**, o gün ana sayfada görüyor ve isterse telefonda hatırlatılıyorsa; fakat Task/Notification/Calendar kavramları birbirine karışmıyorsa tamamdır.
