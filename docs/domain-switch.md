# Moving the site to joker-chess.com (checklist)

Why it is not just a CNAME swap: the installed apps (1.1) load `https://golden-chess.com/` in their webview
(`app/capacitor.config.json` → `server.url`, `allowNavigation`). If golden-chess.com turns into a registrar forward, those
apps break (a 301 to another host is blocked by allowNavigation). So golden-chess.com must keep *serving* the site until
the 1.2 apps (which load joker-chess.com) are out and the old ones have mostly updated.

## Plan

1. **DNS (GoDaddy, joker-chess.com)**: four A records for `@` → 185.199.108.153, 185.199.109.153, 185.199.110.153,
   185.199.111.153; `www` CNAME → `ukazyra-collab.github.io`. Same as golden-chess.com today (README).
2. **Second Pages site**: a repo `ukazyra-collab/joker-chess` whose Pages custom domain is joker-chess.com. The main
   repo's workflow copies the built site (index.html, privacy/support/google.html, og.png, icons, app/resources/icon.png)
   there on every push to main. One build, two hosts. (GitHub Pages allows one custom domain per repo.)
3. **build.js**: `SITE` → `https://joker-chess.com/`, `googleReturn` → `https://joker-chess.com/google.html`, the
   TO_HTTPS script also redirects *browsers* on golden-chess.com to joker-chess.com (same path), but not the app
   (`window.Capacitor` present → stay).
4. **Supabase** → Authentication → URL configuration: Site URL `https://joker-chess.com/`, add Redirect URL
   `https://joker-chess.com/**` (keep the golden-chess.com one until the old apps are gone).
5. **Google Cloud** OAuth client "Joker Chess web": add authorised origin `https://joker-chess.com` and redirect URI
   `https://joker-chess.com/google.html` (keep the old ones). OAuth consent screen: app name Joker Chess, home page and
   privacy links on joker-chess.com.
6. **Apple** Sign in with Apple service id: add `joker-chess.com` domain + return URL.
7. **App 1.2**: `capacitor.config.json` `server.url` → `https://joker-chess.com/`, allowNavigation += joker-chess.com,
   www.joker-chess.com (keep golden-chess.com too). `app/listing.json` privacy/support/marketing URLs → joker-chess.com.
8. **Texts**: privacy.html, support.html, README.md, supabase/emails/README.md, app/README.md, the Supabase email
   templates' footer, the outreach letters (already say joker-chess.com).
9. Later (months): golden-chess.com → registrar forward to https://joker-chess.com, remove the old origins.
