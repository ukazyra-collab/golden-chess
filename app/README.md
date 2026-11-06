# Golden Chess — приложение для iPhone и Android

Папка `app/` — нативная оболочка (Capacitor 8) вокруг сайта. Приложение открывает **живой сайт** (`server.url` в `capacitor.config.json`), поэтому всё, что выкатывается на сайт, появляется в приложении сразу, без новой сборки и без ревью. Пересобирать нужно только когда меняется нативная часть: иконка, адрес сайта, плагины.

Что умеет нативная часть сверх сайта:
- **Вход через Google** открывает страницу Google в системном браузере (Google запрещает вход во встроенном браузере приложения). Google отвечает на golden-chess.com/google.html — поэтому на его странице написано golden-chess.com, а не адрес Supabase, — и эта страница возвращает ответ в приложение по ссылке `goldenchess://auth`. Вход по коду из письма работает прямо в приложении.
- **Без интернета** приложение открывает свою копию сайта (`www/index.html`): боты и игра вдвоём на одном телефоне работают, онлайн — после «Повторить».
- Иконка (золотой конь со звездой), заставка, тёмные системные панели, на iPhone без «резинки» у краёв, на телефонах только вертикально (планшеты — как угодно), кнопка «назад» на Android закрывает окно → предыдущий экран → сворачивает приложение, «Поделиться» приглашением через системное меню.

| | iPhone | Android |
|---|---|---|
| Идентификатор | `com.kozyramedia.goldenchess` (для кабеля без платного аккаунта — `….dev`, см. ниже) | `com.kozyramedia.goldenchess` (в Play Console фиксируется навсегда) |
| Версия | 1.0 (1) — Xcode → target App → General | 1.0 (1) — `android/app/build.gradle` |

---

## 1. Один раз: Supabase и Google

1. Supabase → **Authentication → URL Configuration → Redirect URLs** → добавить `goldenchess://auth`. Без этого вход из приложения вернётся не в приложение, а на сайт в браузере.
2. Supabase → **Authentication → Sign In / Providers → Google**: включён, Client ID и Client Secret из Google Cloud. Там же включено **Allow manual linking** (гость привязывает Google к своему же аккаунту, рейтинг и партии остаются).
3. Google Cloud: у клиента «Golden Chess web» источник `https://golden-chess.com` и адрес возврата `https://golden-chess.com/google.html` — их хватает и сайту, и приложению. Supabase проверяет токен Google по этому же Client ID.
4. **Вход через Apple** (iPhone, сборка 1.1 и новее): нативная кнопка «Войти через Apple» — плагин `@capacitor-community/apple-sign-in` из `app/plugins/apple-sign-in/` (копия версии 7.1.0 с `Package.swift` под Capacitor 8: опубликованная версия требует capacitor-swift-pm 7.x и не собирается рядом с Capacitor 8), право `com.apple.developer.applesignin` в `ios/App/App/App.entitlements`, возможность Sign in with Apple на App ID включает `python3 asc.py capability`. Сайт получает от Apple ID-токен и отдаёт его Supabase (`signInWithIdToken`, провайдер Apple с Client ID `com.kozyramedia.goldenchess`, ключ и Services ID для нативного входа не нужны). Supabase → **Authentication → Sign In / Providers → Apple**: включён, Client IDs = `com.kozyramedia.goldenchess`. Флаг `appleAuth` в `build.js`.
   **App Store, правило 4.8** (рядом со входом через другую компанию нужен вход через Apple): на iPhone кнопка Google показывается только рядом с Apple (`appleShown()` / `googleShown()` в `src/ui/app.js`), в старой сборке 1.0 без плагина остаётся только код из письма — он попадает в тот же аккаунт, что и Google или Apple с той же почтой. Android и сайт — с Google, как раньше; на сайте входа через Apple нет (ему нужны Services ID и ключ, который перевыпускается каждые полгода).

   **Выпуск 1.1 в App Store** (на Маке, переменные как в §4): `cd golden-chess/app && git pull && npm install && python3 asc.py capability && sh ios_release.sh && python3 asc.py build --wait && python3 asc.py metadata && python3 asc.py submit`.

   **Тексты и скриншоты магазинов** (ноя 2026): App Store — `listing.json` (имя «Golden Chess — One Golden Move», подзаголовок «One move that changes the game», описание в духе рассылки: «кажется, мы починили шахматы»), скриншоты `store/appstore/` (первый экран — сам золотой ход: конь с золотой стрелкой через всю доску); Google Play — тексты EN/RU в `listing.play.json`, кадры `store/play/{en,ru}/play-N.png` и баннер `feature-graphic.png` (их же отдаёт сайт: `https://golden-chess.com/app/store/play/en/play-1-golden.png`, так их можно подставить в форму Play Console прямо из браузера). Пересобрать: `python3 test/store_shots.py <папка> en` (и `ru android`), затем `python3 test/store_frames_ios.py <папка> en` и `python3 test/store_frames.py <папка> en|ru`. Поменять тексты/скриншоты уже поданной версии: `python3 asc.py cancel && python3 asc.py metadata && python3 asc.py screenshots store/appstore && python3 asc.py submit` (на ноуте это `~/hutka/_release/gc-5-listing.command`). Apple дообрабатывает скриншоты после загрузки, и `submit` ждёт до часа; если он так и не прошёл (ASSET_IN_POST_PROCESSING), `python3 asc.py screens store/appstore` покажет состояние каждого скриншота (COMPLETE / FAILED с причиной) и перезальёт набор с застрявшим — `gc-6-screens.command` на ноуте делает это и подаёт снова.

## 2. iPhone по кабелю (без платного аккаунта)

Нужны Mac, Xcode (App Store) и Node (`brew install node`). В Терминале:

```bash
cd ~/Desktop
git clone https://github.com/ukazyra-collab/golden-chess.git
cd golden-chess/app
npm install
sh build.sh      # переносит настройки и офлайн-копию в проекты iOS и Android
sh dev.sh        # идентификатор ….dev для личной команды (Personal Team)
npx cap open ios # откроется Xcode; в первый раз он минуту-две качает пакеты Capacitor
```

В Xcode:
1. Слева проект **App** → target **App** → вкладка **Signing & Capabilities** → **Team** = твой Apple ID (Personal Team), «Automatically manage signing» включено.
2. iPhone по кабелю → выбрать его сверху в списке устройств → **▶ Run**. Первый раз на телефоне: **Settings → Privacy & Security → Developer Mode → On** (если ещё не включён после Hutka) и **Settings → General → VPN & Device Management → Apple Development: … → Trust**. С бесплатным Apple ID сборка живёт 7 дней, потом снова ▶ Run.
3. Проверить: заставка, вход через Google (вернулся в приложение), игра с ботом, приглашение другу → «Поделиться», режим полёта → копия без интернета.

Обновить потом: `sh release.sh && git pull && npm install && sh build.sh && sh dev.sh`, затем ▶ Run.

Почему `dev.sh`: App ID, который зарегистрирует личная команда, потом нельзя будет взять команде Kozyra Media — поэтому для кабеля отдельный `com.kozyramedia.goldenchess.dev`. Перед сборкой в магазин: `sh release.sh`.

## 3. Android

**Без инструментов.** Каждая правка в `app/` сама собирается на GitHub (Actions → «App builds») и выкладывается в релиз **android-test**:
открыть на телефоне https://github.com/ukazyra-collab/golden-chess/releases/tag/android-test → `golden-chess.apk` → установить (телефон спросит **Allow from this source** для браузера — разрешить). Новая версия ставится поверх старой — тестовые сборки подписаны одним ключом (`android/app/debug.keystore`, он не для Google Play).

**Через Android Studio.** `cd golden-chess/app && npm install && sh build.sh && npx cap open android` → телефон по USB (**Settings → About phone → Build number** 7 раз → **Developer options → USB debugging**) → **▶ Run**.

## 4. Магазины

Удаление аккаунта (требуют оба магазина): **Профиль → Удалить аккаунт**, функция `delete_my_account()` в базе; адрес для форм магазинов — https://golden-chess.com/privacy.html#delete. Поддержка — https://golden-chess.com/support.html, политика — https://golden-chess.com/privacy.html. Скриншоты и графика для магазинов: `python3 test/store_shots.py <папка> en|ru` (Android 1080×2160, iPhone 6.9" 1320×2868, iPad 13" 2064×2752, баннер Google Play 1024×500, иконка 512). Google Play принимает скриншоты телефона только 9:16 — их собирает `python3 test/store_frames.py <папка> en|ru` (экран под подписью, 1080×1920). Готовые файлы и подписанный `.aab` лежат в ветке `store-builds` (папки `store/en`, `store/ru`).

**Google Play.** Каждая правка в `app/` собирает на GitHub ещё и неподписанный `.aab` (релиз **android-bundle**, файл `golden-chess-unsigned.aab`). Его подписывает ключ загрузки (`golden-chess-upload.jks`, alias `upload`; хранится вне репозитория, у владельца аккаунта вместе с паролем):

```bash
jarsigner -keystore golden-chess-upload.jks -sigalg SHA256withRSA -digestalg SHA-256 golden-chess-unsigned.aab upload
jarsigner -verify golden-chess-unsigned.aab   # jar verified.
```

Приложение для пользователей подписывает сам Google (Play App Signing). Перед каждой новой загрузкой — `versionCode` +1 и `versionName` в `android/app/build.gradle`.

**App Store, автоматом (29 окт 2026, версия 1.0 / build 1)** — тот же комплект, что у Hutka (`hutka/app/README.md` §3a): ключ App Store Connect API уже есть на Маке (`~/.appstoreconnect/private_keys/AuthKey_3N3G83NP8F.p8`, Team ID F3P87X2A7L), скрипты в `app/`: `asc.py` (bundle id, тексты из `listing.json`, скриншоты из `store/appstore/`, билд, submit), `ios_release.sh` (cap sync → archive → export → upload), `ios/App/ExportOptions.plist`, `ios/App/App/PrivacyInfo.xcprivacy`. Скриншоты для стора в стиле Play-карточки делает `python3 test/store_frames_ios.py <папка с iphone69-*/ipad13-*.png> en` → `app/store/appstore/{iphone67,ipad129}/0N.png`. Переменные окружения: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `TEAM_ID`, `GC_REVIEW_EMAIL`, `GC_REVIEW_PHONE`, `GC_REVIEW_ACCOUNT`, `GC_REVIEW_PASSWORD` (демо-аккаунт — `review@kozyramedia.com`). Руками на сайте: запись приложения (New App), App Privacy (почта, имя, user ID, игровой контент — привязаны к аккаунту, без трекинга), цена $0.00 и доступность.

**App Store, вручную.** `sh release.sh` → Xcode → Team = Kozyra Media → **Product → Archive → Distribute App → App Store Connect**. В App Store Connect: New App, Bundle ID `com.kozyramedia.goldenchess`, категория Games → Board, App Privacy: почта, имя, ID пользователя, игровой контент — для работы приложения, не для рекламы и не для слежки. `ITSAppUsesNonExemptEncryption = false` уже в `Info.plist`, вопрос про шифрование не задаётся. Перед каждой новой загрузкой — build +1 (Xcode → target App → General).

## Что где

- `capacitor.config.json` — `server.url` (живой сайт, https://golden-chess.com/; если адрес когда-нибудь поменяется — поправить и пересобрать обе платформы), `errorPath` (офлайн-копия), `allowNavigation`, цвета заставки и системных панелей.
- `www/index.html` — офлайн-копия сайта, её делает `node build.js` в корне репозитория. Руками не править.
- `resources/make_icons.py` — иконки и заставки для обеих платформ и `apple-touch-icon.png` сайта из одного рисунка: `python3 app/resources/make_icons.py`.
- iOS: `Info.plist` (схема `goldenchess`, на iPhone только вертикально), `SceneDelegate.swift` (без «резинки»), `LaunchScreen.storyboard` (фон заставки).
- Android: `AndroidManifest.xml` (возврат по `goldenchess://auth`), `MainActivity.java` (телефоны вертикально), `res/values/styles.xml` (заставка), адаптивная иконка с монохромным вариантом для тем Android 13.
- Сайт: `NATIVE`, `nativeUrl`, `nativeBack`, `nativeInit` в `src/ui/app.js`; проверка — `python3 test/native_app.py`.
- Сборки: `.github/workflows/app.yml`.
