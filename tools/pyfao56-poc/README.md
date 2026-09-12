# pyfao56 bağımsız deneme

Bu klasör, [pyfao56](https://github.com/kthorp/pyfao56) ile yedi günlük **sentetik** hava verisinden referans ET, bitki ET ve kök bölgesi su açığı hesaplar. Uygulamanın sulama kararlarına veya Vercel build'ine bağlı değildir; burada görülen sayılar gerçek tarlaya öneri değildir.

```bash
python -m venv /tmp/tarlapusula-pyfao56-venv
/tmp/tarlapusula-pyfao56-venv/bin/python -m pip install -r tools/pyfao56-poc/requirements.txt
/tmp/tarlapusula-pyfao56-venv/bin/python tools/pyfao56-poc/run.py
```

Çıktı, `data_type: synthetic` etiketiyle yedi günlük JSON üretir. pyfao56 referans ET için ASCE standart denklemini kullanır; uygulamadaki Open-Meteo `et0_fao_evapotranspiration` ile farklılıklar beklenebilir. Gerçek karşılaştırma için aynı tarih, koordinat, hava girdileri, ürün evresi, toprak parametreleri ve sulama kayıtlarının doğrulanıp eşleştirilmesi gerekir.

## Aynı tarih ve katsayıyla ET karşılaştırması

`compare.py`, yalnızca yerel JSON'dan iki veya daha çok ardışık gün için referans ET'yi ve **aynı uygulama Kc'siyle** çarpılmış iki ET değerini yan yana hesaplar. Girdi şablonu:

```json
{
  "data_type": "observed",
  "source": "Doğrulanmış meteoroloji kaynağı ve uygulama ET0 dışa aktarımı",
  "station": { "latitude": 39.9, "elevation_m": 100, "wind_height_m": 2 },
  "days": [
    { "date": "2026-06-01", "solar_radiation_mj_m2": 22, "tmax_c": 29, "tmin_c": 15, "rhmax_pct": 80, "rhmin_pct": 40, "wind_m_s": 2, "rain_mm": 0, "app_et0_mm": 5.1, "app_kc": 0.5 },
    { "date": "2026-06-02", "solar_radiation_mj_m2": 22, "tmax_c": 29, "tmin_c": 15, "rhmax_pct": 80, "rhmin_pct": 40, "wind_m_s": 2, "rain_mm": 0, "app_et0_mm": 5.1, "app_kc": 0.5 }
  ]
}
```

Bu sayılar yalnızca **girdi biçimi örneğidir**, saha ölçümü değildir. Gerçek kullanıcı verisini repoya commit etmeyin. `app_et0_mm` uygulamadaki Open-Meteo ET₀, `app_kc` aynı güne ait uygulama ürün katsayısı olmalı. Yağış miktarı kaydedilir ancak bu karşılaştırmanın ET hesaplarına katılmaz.

```bash
/tmp/tarlapusula-pyfao56-venv/bin/python tools/pyfao56-poc/compare.py /yerel/yol/gunluk-veri.json
```

Eksik günlük meteoroloji veya uygulama ET₀/Kc verisini tahmin ederek doldurmaz; hata verir. Çıktıdaki fark iki ayrı referans ET metodunu da içerir; “uygulama hatası” veya sulama miktarı olarak yorumlanamaz. Gerçek sulama kararı karşılaştırması için ayrıca doğrulanmış toprak başlangıç suyu, kök profili ve sulama geçmişi gerekir.
