# TarlaPusula Model Gateway

Bu servis Python tabanlı tarım motorlarını React uygulamasından ayırır. Harici motorlar doğrudan UI veya Pusula AI tarafından çağrılmaz.

Akış:

`React / Supabase -> trusted backend -> Model Gateway -> engine adapter -> Decision Layer -> Pusula`

## İlk dalga

- `pyfao56`: shadow modda gerçek su dengesi karşılaştırması.
- `PCSE/WOFOST`: pilot/readiness; gerçek tarla hava + ürün + toprak + site + agromanagement girdileri tamamlanmadan çalıştırılmaz.
- `AquaCrop-OSPy`: pilot/readiness; gerçek sezon/su/toprak girdileri tamamlanmadan çalıştırılmaz.

Aşağıdaki motorlar registry'de kayıtlıdır ancak kapalıdır: AutoGeoBound, OpenAgri Pest&Disease, AgML, FarmVibes.AI.

## Çalıştırma

```bash
cd services/model-gateway
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8080
```

Development dışında `MODEL_GATEWAY_SHARED_KEY` tanımlanmalıdır. Bu anahtar frontend'e konmaz. `VITE_*` secret kullanılmaz.

## Güvenlik / veri ilkeleri

- Gateway public frontend endpoint'i değildir.
- Motor sonucu production otoritesi değildir; rollout registry belirler.
- Eksik tarla girdisi sahte/default tarla verisiyle doldurulmaz.
- pyfao56 shadow sonucu mevcut TarlaPusula Irrigation Engine kararını değiştirmez.
- PCSE ve AquaCrop gerçek tarla girdileri tamamlanana kadar kullanıcı tavsiyesi üretmez.
- Upstream sürümleri bilinçli pin ile tutulur ve yükseltmeler benchmark ister.
