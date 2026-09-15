# 30 — `Haritada gör`: temiz focus mode

## Sorun

Pusula `Haritada göster` dediğinde harita hedef alana gidiyor; fakat mevcut focus akışında aynı anda:

- sağ kontrol rayı,
- katman butonları,
- focus önce/sonra kontrolleri,
- `Tümü`,
- fotoğraf ekleme,
- takip/tarla aksiyonları,
- hedef alan etiketi

aynı küçük mobil yüzeyde görünebiliyor. Sonuç: metin okunmuyor, ikonlar üst üste geliyor ve odak gösterme işlevi kendi UI'ı tarafından kapatılıyor.

## Ürün kararı

`Haritada gör` normal harita araçlarını bir süreliğine azaltan ayrı bir **Focus Mode** açar.

Amaç: kullanıcı önce **hangi bölgenin gösterildiğini** anlasın; sonra ilgili aksiyonu seçsin.

## Focus Mode görünümü

### Üst

Tek kompakt header:

```text
[ ← ]  Zayıf gelişim · 1/2                    [ × ]
```

Birden fazla gerçek alan varsa:

```text
[ ‹ ]     1 / 2     [ › ]
```

Bu navigasyon ayrı butonlar halinde dağılmaz; aynı kompakt grup içinde olur.

### Harita

- hedef gerçek geometri belirgin outline/fill ile gösterilir.
- kamera target bounds'a uygun padding ile oturur.
- etiket hedef alanın üstünü kapatmaz; anchor ve viewport collision kontrolü kullanılır.
- data date + gerçek compass alt HUD görünmeye devam eder.

### Alt aksiyon alanı

Gerekli aksiyonlar tek bottom action bar/sheet'te:

```text
Batı bölümü · saha kontrolü öneriliyor
[Fotoğraf ekle] [Takvimime ekle]
```

Her hedefte bütün aksiyonlar zorla gösterilmez.

## Focus Mode sırasında gizlenecek/sadeleşecek öğeler

- normal katman trigger'ı kapalı veya minimize,
- sağ rail'deki geçmiş/katman/info gibi ilgisiz kontroller gizli,
- zoom +/− gerekirse erişilebilir ama önceliksiz,
- Pusula ana strip tekrar aynı metni göstermiyor,
- üstte uzun yatay action strip yok.

Kullanıcı focus mode'dan çıkınca standart harita kontrolleri geri gelir.

## Birden çok alan

Pusula yalnız gerçek spatial finding varsa focus üretir.

`focusItems`:

```ts
type MapFocusItem = {
  id: string;
  label: string;
  geometry: GeoJSON.Feature;
  reason: string;
  sourceLayer: string;
  evidenceId?: string;
};
```

- `1/2` gerçek `focusItems.length`'den gelir.
- `Tümü` istenirse compact overflow menu içinde olabilir; ana satırı doldurmaz.
- geçersiz geometry için sahte focus alanı çizilmez.

## Fotoğraf ekle ve Görevlerim

### Anında fotoğraf

Kullanıcı `Fotoğraf ekle` seçerse mevcut observation/photo flow açılır.

### Eksik saha kanıtı görevi

Pusula'nın güveni için gerçekten saha fotoğrafı isteniyorsa Task Engine bir görev üretebilir:

```text
Batı bölümünden kontrol fotoğrafı çek            +20P
```

- sadece görevin koşulu doğrulanmış fotoğraf upload/save ile tamamlanır.
- focus mode'a girmek puan vermez.
- fotoğrafı yalnız görüntülemek puan vermez.
- dedupe task/evidence key ile yapılır.

## Takvimime ekle

Saha kontrolü şimdi yapılmayacaksa:

`Takvimime ekle` → prefilled CalendarActionDraft.

Örn:
- başlık: `Batı bölümünü kontrol et`
- tarla: `Bahadırlar-arpa`
- önerilen tarih: bugün/yarın veya Pusula'nın gerçek zamanlama kanıtı
- notes: focus reason + source date

Sadece takvime eklemek puan vermez.

## Focus state

Öneri:

```ts
type MapFocusState = {
  active: boolean;
  items: MapFocusItem[];
  selectedIndex: number;
  origin: 'pusula' | 'observation' | 'task';
};
```

Focus state UI component'tan bağımsız bir hook/service sınırında tutulur.

## Dosya planı

Yeni:

```text
src/features/home-map/focus/types.ts
src/features/home-map/focus/useMapFocusMode.ts
src/features/home-map/focus/MapFocusHeader.tsx
src/features/home-map/focus/MapFocusActions.tsx
src/features/home-map/focus/MapFocusMode.css
```

Değişecek:

```text
src/features/home-map/HomeMapEngine.tsx
src/features/pusula/components/HomeMapPusulaStrip.tsx
src/features/field-observations/components/*
src/features/map-data/components/MapFooterHud.tsx
```

Mevcut `tp:home-map-show-pusula-area` event'i geçiş döneminde adapter olarak tutulabilir; uzun vadede typed focus controller'a taşınır.

## Responsive / safe area

- 320–430 px mobil genişlikte yatay taşma yok.
- top controls notch/browser safe area ile çakışmaz.
- right rail focus mode açıkken hedef etiketiyle üst üste gelmez.
- bottom action bar Pusula strip/bottom nav ile çakışmaz.

## Kabul kriterleri

- [ ] `Haritada gör` hedef alanı ekranda net biçimde gösterir.
- [ ] screenshot'taki gibi üst üste icon/text oluşmaz.
- [ ] 1/2 alan navigasyonu tek kompakt kontrolde okunur.
- [ ] focus mode'da ilgisiz harita kontrolleri gizlenir/minimize edilir.
- [ ] Fotoğraf ekle doğru target area'ya bağlanır.
- [ ] Takvimime ekle prefilled doğru tarla/alan bağlamını taşır.
- [ ] gerçek geometry yoksa kullanıcıya sahte alan gösterilmez.
- [ ] focus mode kapanınca harita standart UI'a döner.
- [ ] yalnız focus açmak Pusula puanı kazandırmaz.

## Bitti tanımı

Kullanıcı `Haritada gör` dediğinde ilk 1 saniyede **“Pusula bana tam olarak nereyi gösteriyor?”** sorusunun cevabını alabiliyor ve kontroller hedef alanı kapatmıyorsa tamamdır.
