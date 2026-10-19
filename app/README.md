# Golden Chess — приложение для iPhone и Android

Папка `app/` — нативная оболочка (Capacitor 8) вокруг сайта. Приложение открывает **живой сайт** (`server.url` в `capacitor.config.json`), поэтому всё, что выкатывается на сайт, появляется в приложении сразу, без новой сборки и без ревью. Пересобирать нужно только когда меняется нативная часть: иконка, адрес сайта, плагины.

Что умеет нативная часть сверх сайта:
- **Вход через Google** открывает системный браузер (Google запрещает вход во встроенном браузере приложения) и возвращается в приложение по ссылке `goldenchess://auth`. Вход по коду из письма работает прямо в приложении.
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
3. Google Cloud для приложения отдельно настраивать не нужно: возврат идёт через Supabase, как на сайте.
4. **Перед App Store:** если в приложении есть кнопка Google, нужен ещё вход через Apple (правило 4.8). Делается после одобрения платного аккаунта Apple — до этого для теста на своём iPhone ничего не нужно.

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

## 4. Магазины (когда одобрят аккаунты Kozyra Media)

**App Store.** Сначала вход через Apple (раздел 1.4) и страница политики конфиденциальности на сайте. Потом `sh release.sh` → Xcode → Team = Kozyra Media → **Product → Archive → Distribute App → App Store Connect**. В App Store Connect: New App, Bundle ID `com.kozyramedia.goldenchess`, категория Games → Board, App Privacy: email и ID пользователя (для аккаунта), игровой контент; не для рекламы и не для слежки. `ITSAppUsesNonExemptEncryption = false` уже в `Info.plist`, вопрос про шифрование не задаётся.

**Google Play.** Android Studio → **Build → Generate Signed App Bundle → Android App Bundle → Create new keystore** (файл `golden-chess-upload.jks` хранить вне репозитория, пароли записать — это ключ загрузки; приложение подписывает сам Google) → `.aab` в `android/app/release/` → Play Console → Create app «Golden Chess» → Internal testing → Production. Версии: `versionCode` +1 на каждую загрузку.

## Что где

- `capacitor.config.json` — `server.url` (живой сайт; после переезда на golden-chess.com поменять и пересобрать обе платформы), `errorPath` (офлайн-копия), `allowNavigation`, цвета заставки и системных панелей.
- `www/index.html` — офлайн-копия сайта, её делает `node build.js` в корне репозитория. Руками не править.
- `resources/make_icons.py` — иконки и заставки для обеих платформ и `apple-touch-icon.png` сайта из одного рисунка: `python3 app/resources/make_icons.py`.
- iOS: `Info.plist` (схема `goldenchess`, на iPhone только вертикально), `SceneDelegate.swift` (без «резинки»), `LaunchScreen.storyboard` (фон заставки).
- Android: `AndroidManifest.xml` (возврат по `goldenchess://auth`), `MainActivity.java` (телефоны вертикально), `res/values/styles.xml` (заставка), адаптивная иконка с монохромным вариантом для тем Android 13.
- Сайт: `NATIVE`, `nativeUrl`, `nativeBack`, `nativeInit` в `src/ui/app.js`; проверка — `python3 test/native_app.py`.
- Сборки: `.github/workflows/app.yml`.
