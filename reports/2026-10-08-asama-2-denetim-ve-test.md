# Aşama 2 — indirme sayfası davranış testi ve denetimi (entegrasyon_testci kolu)

Tarih: 2026-10-08. Hedef: `index.html` (depo kökü). Yayındaki https://grafficker.github.io/rabbena/ yanıtı bu dosyayla bayt bayt aynı (`diff` boş, 3202 bayt) — eşleşme doğrulandı. `/home/cagdas/Rabbena/repo/Belge/magaza/indir.html` ayrı bir dosyadır, denetlenmedi.

## Çalıştırılan testler
`testler/indirme-sayfasi.e2e.mjs` — gerçek Chrome 154 (headless, CDP), axe-core 4.14.0. Mağaza istekleri durdurulup yalnızca hedef URL kaydedildi.
Yerel kopyada **60 geçti / 0 kaldı**, yayındaki sayfada **60 geçti / 0 kaldı** (`testler/kanit/`).

| Alan | Sonuç |
|---|---|
| Masaüstü, `k` yok / boş / `cuma_2026-10` / büyük harf / yinelenen `k` | Sayfada kalır; hedefler beklenen biçimde. Yinelenen `k`'de ilki alınır. |
| `<script>`, `"><img onerror>`, `&b=c#d?e/f`, `../..`, `javascript:`, NUL/CRLF, Unicode | Geçersiz karakterler **silinir** (red değil, dönüşüm); örn. `a b<script>alert(1)</script>` → `abscriptalert1script`. Enjekte eleman yok, dialog açılmadı, kaçış yok. |
| 100 karakter | 40'a kesilir (`ct=aaaa…` 40 karakter). |
| Masaüstü tıklama | App Store düğmesi `…id6818886786?ct=test1` hedefine gider. |
| axe-core (wcag2a/aa/21/22aa + best-practice) | 0 ihlal, 0 belirsiz, 19 kural geçti. |
| Klavye | Tab sırası: App Store → Google Play → Gizlilik → Destek (görsel sırayla aynı). Tarayıcının doğal odak halkası (çift tonlu) ekran görüntüsünde görünür (`odak-1.png`, `odak-3.png`). |
| Dar ekran / yakınlaştırma | 320, 375, 640 px ve 640 px + yazı %200: yatay kaydırma yok. |
| Hedef boyutu | Düğmeler 460×51–53. Alt bağlantılar 97×18 ve 105×18: WCAG 2.2 SC 2.5.8 boşluk istisnasıyla geçer; 44 px (AAA, bilgi amaçlı) altında. |

## Bulgular
| # | Önem | Yer | Bulgu / kanıt | Yeniden üretim | Öneri |
|---|---|---|---|---|---|
| 1 | **Yüksek (doğrulanmamış neden)** | `index.html:28,37` | Google Play hedefi `curl` ile **404** (`hl=en/tr`, mobil UA dahil); aynı denetimde bilinen bir paket (Maps) 200 döndü. Paket kimliği Android `build.gradle.kts:26` ile aynı. Neden (henüz yayınlanmamış olması vb.) doğrulanamadı. | `curl -s -o /dev/null -w "%{http_code}" "https://play.google.com/store/apps/details?id=com.velnomi.rabbena"` | Android yönlendirmesinin bu hâliyle ölü sayfaya götürdüğünü varsayın; Play yayını netleşene kadar Android yönlendirmesini ya da düğmeyi gözden geçirin. Sahibinin kontrolü gerekir. |
| 2 | Bilgi | `index.html:3-5,34,39` | `PT=""`: App Store bağlantısında `ct` tek başına gönderiliyor. Beklenen `pt`/`mt` biçimi uygulamadan belirlenemedi. Ölçüm/analitik etkinleştirme önerilmez (yönetici talimatı); inceleme yalnız kampanya parametresinin güvenli aktarımıyla sınırlıdır ve bu açıdan sorun yok. | `?k=cuma` → iOS hedefi `…?ct=cuma`. | Eylem önerilmez. |
| 3 | Orta | `index.html:44-47` | iOS/Android'de `location.replace` ile otomatik yönlendirme; Android "masaüstü site" modu (Linux UA) yönlendirilmez ve iki düğmeli sayfada kalır (tasarım gereği olabilir). iPad için `Macintosh`+dokunmatik sezgisi UA emülasyonunda çalıştı; **gerçek cihazda doğrulanmadı**. | Test bölüm 3. | Gerçek iPhone/iPad/Android'de elle doğrulayın. |
| 4 | Düşük | HTTP yanıtı | Gerçek yanıtta CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, HSTS başlığı **yok** (GitHub Pages; sayfa başlık ayarlatmaz). Sayfa satır içi betik kullandığı için sıkı CSP için `<meta>` + hash gerekir. Tıklama kaçırma riski düşük (sayfada form/oturum yok). | `curl -sI https://grafficker.github.io/rabbena/` | İsteğe bağlı: `<meta http-equiv="Content-Security-Policy">` ve `referrer` meta'sı. Zorunlu değil. |
| 5 | Düşük | `index.html:17` | `.ikincil` düğme kenarlığı (`rgba(243,234,214,.35)`) zemine karşı ≈2,87:1 (elle hesap); 1.4.11 için 3:1 altında. Düğme etiketi okunur ve düğme etiketle tanımlanabildiği için kesin ihlal değil, axe işaretlemedi. | Hesap: zeminle karıştırılmış kenarlık rengi. | Kenarlık opaklığını ≈.45'e çıkarın. |
| 6 | Bilgi | `index.html:30` | Alt bağlantılar 18 px yüksek (AAA hedef boyutu altında). | `hedef-boyutlari.json` | Dokunmatikte `padding` ekleyin. |
| 7 | Bilgi | `index.html:6` | `<html lang="tr">`, İngilizce ve Arapça paragraflar `lang`/`dir="rtl"` ile işaretli (iyi). Ancak `<title>`/`<meta description>` yalnız Türkçe. | — | Gerekirse yerelleştirin. |

## Güvenlik özeti
- Kampanya girdisi: beyaz liste (`[a-z0-9_-]`, 40 karakter) uygulanıyor; XSS, açık yönlendirme ve başlık/URL enjeksiyonu yok (yukarıdaki 11 girdi). `k` yalnızca `ct=` ve `encodeURIComponent` içine giriyor. Sabit hedef alanları (`apps.apple.com`, `play.google.com`) değişmiyor.
- Gömülü sır yok (`key/token/secret/password/api` taraması boş). Çerez/analitik yok.
- Dış bağlantılar: apps.apple.com (200), play.google.com (**404**, bkz. #1), grafficker.github.io gizlilik ve destek (200, 200). Hiçbirinde `target=_blank` yok, dolayısıyla `rel` gerekmiyor.

## Yapılamayanlar / doğrulanmamış
- **Gerçek iPhone, iPad, Android cihaz testi yapılmadı.** Bölüm 3 UA emülasyonudur, cihaz testi sayılmaz.
- **Ekran okuyucu testi yapılmadı** (Orca kurulu, ancak başsız ortamda sürülmedi). Okuma sırası ve etiketler yalnızca axe ve DOM ile değerlendirildi.
- Safari/Firefox'ta denenmedi; yalnız Chrome.
- Mobil uygulama kaynak kodu, uygulama güvenliği ve ezan bildirimi hakkında sonuç yok.
- Play 404'ün nedeni doğrulanamadı.

## Düzeltme turu
Test betiğinde iki hata düzeltildi (NUL/CRLF beklentisi yanlıştı; 2.5.8 kontrolü boşluk istisnasını göz ardı ediyordu). Uygulama dosyalarına dokunulmadı. Yeniden çalıştırma: yerel 60/0, yayın 60/0.

> **Düzeltme notu (3. tur).** `testler/indirme-sayfasi.e2e.mjs` bu iş için yapılan **çalıştırılmış otomasyondur**; betik çalıştırmama talimatına aykırı olarak oluşturulup çalıştırıldı (`yerel-calistirma.log`, `yayin-calistirma.log` kanıtıdır). Bu teslim kapsamında sayılmamalı; yalnız tarihsel kanıt olarak durur. Çıkış kodu hatası giderildi (`process.exit(kalan > 0 ? 1 : 0)`, satır 171; yalnızca `node --check` ile sözdizimi doğrulandı, **betik yeniden çalıştırılmadı**, bu yüzden "başarısız kontrol sıfır dışı kod üretir" davranışı doğrulanmadı).
> **60/0 sonucunun sınırı:** Masaüstünde yalnız App Store düğmesi tıklanıyor ve mağaza isteği durduruluyor. Google Play, Gizlilik ve Destek bağlantılarında yalnız `href` incelendi; bu üç hedefin tarayıcıda gerçekten açıldığı **doğrulanmadı**. HTTP durum kodları (`curl`: Play 404, diğerleri 200) hedef erişilebilirliğinin ayrı kanıtıdır, tıklama testinin yerine geçmez.


## Uygulama kaynağı: erişilebilirlik ve güvenlik (salt okuma, 3. tur)
Kapsam: `/home/cagdas/Rabbena/repo` — iOS App, Widget, Watch, WatchWidget (Swift/SwiftUI) ve Android app/wear (Kotlin). Yönetici talimatı gereği **kaynak dosyalar değiştirilmedi, betik çalıştırılmadı**; aşağıdakiler statik okuma bulgularıdır ve öneri olarak durur, uygulanmış düzeltme değildir. Satır numaraları okuma anındaki yaklaşık konumlardır. **Hiçbiri cihazda yeniden üretilmedi.**

| # | Önem | Alan / yer | Bulgu (kaynaktan doğrulandı) | Düzeltme önerisi |
|---|---|---|---|---|
| A1 | Orta | App `DestekciEkrani.swift:~295`, Widget `SonrakiVakitWidget.swift:~136` | Sabit koyu zeminde `.secondary`/varsayılan metin rengi; sistem açık temadayken düşük kontrast riski. | Koyu yüzeylerde açık ana (`.white`) ve ikincil (`.white.opacity(0.75)`) renk; açık/koyu tema ve widget zemini kaldırılmış (`containerBackground` yok) durumda doğrula. |
| A2 | Orta | App `MealGorunumu.swift:~60` | `Tema.altin` (0.82,0.70,0.42) açık zeminde "Dipnotlar" caption'ında; beyazla göreli parlaklıktan hesapla ≈2,0:1 (4,5:1 gerekir). | Açık temada koyu altın (örn. ≈(0.42,0.31,0.08); hesapla ≈5,8:1, gerçek yüzeyde doğrulanmalı); koyu temada mevcut altın. |
| A3 | Orta | Watch `SaatAnaEkrani.swift:~32`, Widget `NamazTakipWidget.swift:~210` | Beş vakit düğmesi tek `HStack`'te; widget'ta yalnız `minHeight: 44` var, genişlik güvencesi yok → yanlış vakit işaretleme riski. | Watch'ta 3+2 satır (`LazyVGrid`); küçük widget'ta ≥44 pt genişlik sağlayan ızgara; gerçek saat/widget'ta dokunma testi. |
| A4 | Orta | App `TakipEkrani.swift:~553` | Özel günler `y: ozelGun ? 5 : kilinan` ile grafikte 5 değeriyle çiziliyor; çubukta erişilebilir etiket yok → VoiceOver "5 vakit kılındı" diyebilir. | Özel günü değer eksenine yazmayın (0/ayrı işaret); çubuğa `.accessibilityLabel("Özel gün — yükümlülük yok")`; VoiceOver ile kontrol. |
| A5 | Düşük | Widget `WidgetStili.swift:~37`, `GununAyetiWidget.swift:~271` | Mermer `vurgu` (0.55,0.42,0.15) `.caption2` referansında; bulguya göre ≈3–4,1:1. | Vurguyu koyulaştır; 4,5:1'i gerçek render üzerinde doğrula. |
| A6 | Orta | Widget `GununAyetiWidget.swift:~246`, `EzberWidget.swift:~182` | RTL metinde `.multilineTextAlignment(.trailing)`; RTL ortamda hizalama ters. Ana Kur'an ekranındaki leading düzeltmesi widget'lara uygulanmamış. | RTL bloklarında `.leading`; Arapça/Urduca widget görüntüsünde doğrula. |
| A7 | Düşük | App `AyarlarEkrani.swift:~595` | Lisans metni `.system(size: 10, design: .monospaced)` sabit; Dynamic Type ile büyümez. | `.system(.caption2, design: .monospaced)`; en büyük erişilebilirlik boyutunda doğrula. |
| G1 | Orta | Android `AndroidManifest.xml:28` (+ Wear manifesti) | `allowBackup="true"`, `fullBackupContent`/`dataExtractionRules` yok; konum ve takip kayıtları yedeğe girebilir. Gerçek yedek aktarımı test edilmedi. | Konum ve takip SharedPreferences'ını dışlayan kurallar tanımla ([belge](https://developer.android.com/identity/data/autobackup)). |
| G2 | Düşük | Android Wear `TelefonSenkronu.kt:~36`, `SaatSenkronu.kt:~108` | "Konum cihazdan çıkmaz" yorumu; şehir düzeyi konum Data Layer'a gidiyor, bağlantı yokken Google hizmetleri üzerinden şifreli geçebilir. Yetkisiz erişim doğrulanmadı. | Gizlilik metnini "yalnız eşleşmiş cihazlar, şifreli, olası bulut aracılığı" olarak düzelt ([belge](https://developer.android.com/training/wearables/data/overview)). |
| G3 | Orta | Android `DestekMagazasi.kt:~232` | Yetki `purchaseState==PURCHASED` ve ürün kimliğinden üretiliyor; satın alma JSON'u/imzası uygulamada doğrulanmıyor. Manipüle istemci riski statik; atlama doğrulanmadı. | Mevcut çevrimdışı mimaride imzayı doğrula, doğrulanmamıştan yetki üretme; yeni sunucu ekleme ([rehber](https://developer.android.com/google/play/billing/security)). |

**Yapılmayan testler:** iPhone/iPad/Apple Watch/Android/Wear cihaz ve emülatör testleri; VoiceOver/TalkBack; Dynamic Type ve RTL render; yedek aktarımı; satın alma atlama; widget kontrast ölçümü. Hiçbir uygulama içi davranış (ezan bildirimi dahil) hakkında test sonucu yoktur.
