# Письма Golden Chess (Supabase Auth → Emails → Templates)

Вход по почте устроен как в Hutka: в письме шестизначный код (основной путь) и ссылка «в одно касание» для того же устройства.

| Шаблон в Supabase | Файл | Subject | Когда приходит |
|---|---|---|---|
| Change email address | `email-change.html` | `{{ .Token }} is your Golden Chess code` | гость сохраняет прогресс: почта добавляется к тому же аккаунту (тот же игрок, рейтинг, партии) |
| Magic link or OTP | `magic-link.html` | `{{ .Token }} is your Golden Chess code` | вход в существующий аккаунт на другом устройстве |
| Confirm sign up | `confirm-signup.html` | `{{ .Token }} is your Golden Chess code` | вход с новой почтой без гостевой сессии (редко) |

Код в теме письма виден прямо в уведомлении на телефоне.

Переменные `{{ .Token }}` (код), `{{ .ConfirmationURL }}` (ссылка), `{{ .Email }}` / `{{ .NewEmail }}` подставляет Supabase. Шаблон вставляется целиком в поле Body, тема — в Subject.

Остальные настройки проекта `wduoqpoqbtpkrgbcsegg`:

- URL Configuration: Site URL `https://ukazyra-collab.github.io/golden-chess/`, Redirect URLs `https://ukazyra-collab.github.io/golden-chess/**`.
- Email OTP (Sign In / Providers → Email): длина 6 (в проекте по умолчанию было 8; клиент ждёт `GC_ONLINE.otpLength` = 6), срок 3600 с.
- Свой отправитель: Authentication → Emails → SMTP Settings → Enable Custom SMTP (Resend): host `smtp.resend.com`, port `465`, user `resend`, password = API-ключ Resend, sender `chess@hutka.ai`, name `Golden Chess`. Без своего SMTP Supabase шлёт письма только участникам проекта и с жёстким лимитом.
- После SMTP: Authentication → Rate Limits → emails sent — 100 в час.

Google (подготовлено, выключено флагом `googleAuth` в `build.js`):

1. Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web). Authorized redirect URI: `https://wduoqpoqbtpkrgbcsegg.supabase.co/auth/v1/callback`. Authorized JavaScript origin: `https://ukazyra-collab.github.io`.
2. Supabase → Authentication → Sign In / Providers → Google: включить, вставить Client ID и Client Secret.
3. Supabase → Authentication → Sign In / Providers: включить «Allow manual linking» (гость привязывает Google к тому же аккаунту через `linkIdentity`).
4. `build.js`: `googleAuth: true` в `GC_ONLINE`, собрать и запушить.
