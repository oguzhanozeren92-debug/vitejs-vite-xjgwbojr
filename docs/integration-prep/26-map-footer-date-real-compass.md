# 26 — Harita alt HUD: veri tarihi + gerçek pusula

## Amaç

Harita büyütülmeden önce kullanıcı haritanın alt kenarında iki temel bağlamı her zaman görebilmeli:

1. görüntü/veri tarihi,
2. haritanın gerçek yönünü gösteren pusula.

Bu iki bilgi Pusula AI kartının içine karışmaz; harita verisinin kendi HUD katmanıdır.

## Mevcut durum

- `MapDataDate.tsx` veri tarihini zaten formatlayabiliyor.
- `MapCompass.tsx` MapLibre bearing değerini okuyup pusulayı döndürüyor ve dokununca kuzeye döndürüyor.
- mevcut pusula 54–58 px koyu kare kontrol içinde ve altın vurgu kullanıyor.
- map-first görünümünde veri/tarih ve kontrol yerleşimi farklı katmanlar tarafından yönetildiği için görsel hiyerarşi dağınık.

## Hedef görünüm

Haritanın alt iç kenarında, Pusula öneri şeridinin hemen üstündeki güvenli alanda tek HUD satırı:

```text
[ NDVI · 12.09.2026 ]                         [ gerçek pusula ]
```

### Tarih

- görünür ve okunaklı olmalı; kullanıcı detay açmak zorunda kalmamalı.
- `NDVI · 12.09.2026`, `Radar · 10–12.09.2026` gibi katmana göre doğru başlık.
- veri yoksa tarih uydurulmaz; `Veri tarihi yok` / `Güncelleniyor` durumu ayrı gösterilir.
- geçmiş görüntü seçildiğinde tarih anında seçili geçmiş tarihe döner.
- `Güncel` etiketi yalnız gerçekten son kullanılabilir görüntü seçiliyken gösterilir.

### Gerçek pusula

- tam daire; kare/kart hissi minimum.
- 42–46 px mobil boyut.
- `K / D / G / B` harfleri küçük ama okunaklı.
- kuzey yönü belirgin; **altın/sarı branding kullanılmaz**.
- Obsidian Green yüzey + beyaz/açık gri + restrained emerald/cyan yön vurgusu.
- harita bearing değiştikçe pusula rose gerçek zamanlı döner.
- pusulaya dokunmak haritayı `bearing: 0` ile kuzeye getirir.
- sadece görsel logo değildir; gerçek map orientation control'dür.

## Yerleşim kuralı

`MapFooterHud` önerisi:

```text
src/features/map-data/components/MapFooterHud.tsx
src/features/map-data/components/MapFooterHud.css
```

İçinde:

- `MapDataDate`
- yeni görsel kabuk / reusable `MapBearingCompass`

olur. MapLibre kontrolünü DOM üzerinde ayrı köşeye eklemek yerine map component state/bearing ile React HUD'a taşımak tercih edilir. Eğer mevcut IControl korunursa aynı pusulanın ikinci kopyası gösterilmez.

## Fullscreen davranışı

- normal haritada HUD görünür.
- haritaya dokunup tam ekran olduğunda da aynı HUD korunur; yalnız safe-area ölçüleri yeniden hesaplanır.
- iOS alt safe area ve Pusula strip üst üste binmez.
- history sheet/focus mode açıldığında HUD gerektiğinde kompaktlaşır ama tarih kaybolmaz.

## Görev / Pusula puanı ilişkisi

Bu HUD bilgi aracıdır; kendisi görev üretmez ve puan vermez.

Ancak veri tarihi çok eskiyse:
- bu durum kullanıcı tarafından çözülemiyorsa **Görev yapılmaz**,
- Pusula kanıt kalitesi düşürülür,
- gerekirse bilgi/uyarı olarak gösterilir.

Pusulaya dokunmak veya haritayı kuzeye çevirmek puan kazandırmaz.

## Dokunulacak dosyalar

- `src/components/MapCompass.tsx` — görünüm ve/veya control API sadeleştirmesi
- `src/features/map-data/components/MapDataDate.tsx`
- `src/features/map-data/components/MapDataDate.css`
- `src/features/home-map/HomeMapEngine.tsx`
- `src/features/home-map/components/HomeMapSectionMapFirst.tsx`
- yeni `MapFooterHud.tsx/.css`

## Kabul kriterleri

- [ ] normal haritada tarih ekrana ilk bakışta görünür.
- [ ] gerçek pusula normal haritada görünür.
- [ ] pusula harita bearing ile doğru döner.
- [ ] pusulaya dokununca kuzey sıfırlanır.
- [ ] sarı/altın vurgu yoktur.
- [ ] normal ve fullscreen görünümde HUD ikon rayıyla çakışmaz.
- [ ] geçmiş tarih seçimi HUD tarihini doğru günceller.
- [ ] veri yokken sahte tarih gösterilmez.
- [ ] küçük iPhone viewport'unda Pusula öneri şeridiyle üst üste binmez.

## Bitti tanımı

Kullanıcı haritayı büyütmeden önce **hangi tarihli veriye baktığını ve haritanın yönünü** aynı anda anlayabiliyorsa bu iş bitmiştir.
