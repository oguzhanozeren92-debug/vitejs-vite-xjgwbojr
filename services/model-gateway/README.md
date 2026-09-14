# TarlaPusula Model Gateway

Bu servis Python tabanlı tarım motorlarını React uygulamasından ayırır. Harici motorlar doğrudan UI veya Pusula AI tarafından çağrılmaz.

Akış:

`React / Supabase -> trusted backend -> Model Gateway -> engine adapter -> Decision Layer -> Pusula`

## İlk dalga

- `pyfao56`: shadow modda yalnız referans ET0 + TarlaPusula'nın doğrulanmış günlük Kc değeriyle ETc karşılaştırması. Tam kök-bölgesi su dengesi değildir ve production sulama kararını değiştirmez.
- `PCSE/WOFOST`: pilot/readiness; gerçek tarla hava + ürün + toprak + site + agromanagement girdileri tamamlanmadan çalıştırılmaz.
- `AquaCrop-OSPy`: pilot/readiness; gerçek sezon/su/toprak girdileri tamamlanmadan çalıştırılmaz.

Aşağıdaki motorlar registry'de kayıtlıdır ancak kapalıdır: AutoGeoBound, OpenAgri Pest&Disease, AgML, FarmVibes.AI.

## Bağımlılık grupları

İlk canlı gateway deploy'u hafif tutulur:

```bash
pip install -r requirements.txt
```

Bu paket yalnız FastAPI + pyfao56 shadow runtime'ını zorunlu kurar. PCSE ve AquaCrop tam pilot runtime'ı gerektiğinde ayrıca:

```bash
pip install -r requirements-pilot.txt
```

ile kurulur. Readiness endpointleri ağır pilot paketleri kurulu olmasa da çalışır ve motor availability bilgisini açıkça raporlar.

## Yerel çalıştırma

```bash
cd services/model-gateway
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8080
```

Development dışında `MODEL_GATEWAY_SHARED_KEY` tanımlanmalıdır. Bu anahtar frontend'e konmaz. `VITE_*` secret kullanılmaz.

## Vercel yedek deploy yolu

Vercel projesinin Root Directory değeri `services/model-gateway` olmalıdır. `app.py` FastAPI entrypoint'idir; `vercel.json` fonksiyon süresini 60 saniyeye ayarlar. İlk deploy yalnız `requirements.txt` ile pyfao56 shadow runtime'ını kurar.

Vercel ortam değişkenlerinde en az:

- `MODEL_GATEWAY_ENV=production`
- `MODEL_GATEWAY_SHARED_KEY=<server-only-secret>`

olmalıdır. Bu değerler mobil uygulamaya veya `VITE_*` değişkenlerine yazılmaz. Aynı secret Supabase `model-engine-shadow` Edge Function tarafındaki `MODEL_GATEWAY_SHARED_KEY` ile eşleşmelidir; gateway URL de yalnız Supabase server secret'ı olarak tutulur.

## Güvenlik / veri ilkeleri

- Gateway public frontend endpoint'i değildir; yalnız trusted backend çağırır.
- Motor sonucu production otoritesi değildir; rollout registry belirler.
- Eksik tarla girdisi sahte/default tarla verisiyle doldurulmaz.
- pyfao56 shadow sonucu mevcut TarlaPusula Irrigation Engine kararını değiştirmez.
- pyfao56 tam su dengesi; doğrulanmış basal Kcb, yüzey buharlaşma katmanı ve mevcut toprak suyu olmadan açılmaz.
- PCSE ve AquaCrop gerçek tarla girdileri tamamlanana kadar kullanıcı tavsiyesi üretmez.
- Upstream sürümleri bilinçli pin ile tutulur ve yükseltmeler benchmark ister.
