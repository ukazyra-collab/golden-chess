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

## State (8 Nov 2026)

- joker-chess.com is bought (GoDaddy); two A records point to GitHub Pages. The site is still served on golden-chess.com
  (CNAME), because the installed 1.2 apps load it.
- The code works on either address: Google answers to `google.html` on the page's own address (`googleReturn()` in
  app.js), plain http goes to https on the same host, `siteLink()` takes links to both domains.
- App 1.3 still loads golden-chess.com, allows both domains, and has universal / app links for both.
- The flip, once 1.3 is out and the old apps have updated: CNAME → joker-chess.com, `SITE` in build.js →
  joker-chess.com, listing.json / privacy / support / email texts → joker-chess.com; Google Cloud: add origin
  https://joker-chess.com and redirect URI https://joker-chess.com/google.html; Supabase: Site URL + redirect URL;
  GoDaddy: golden-chess.com → forwarding (301) to https://joker-chess.com. The 1.3 apps follow the 301 (golden-chess.com
  and joker-chess.com are both in allowNavigation).

## State (9 Nov 2026): the move

- The site lives on **joker-chess.com**, served by a second Pages repo, `ukazyra-collab/joker-chess` (main, root; CNAME
  joker-chess.com). It holds only the published files: index.html, privacy.html, support.html, google.html, the Search
  Console file, og.png, apple-touch-icon.png, version.json, .nojekyll, .well-known/ (AASA + assetlinks).
- This repo (golden-chess) keeps golden-chess.com on Pages, but only to hand over: the head script in index.html
  (build.js `TO_HTTPS`), privacy.html and support.html send a browser to the same page on joker-chess.com; the app goes
  too when it is 1.3 or later (it allows joker-chess.com); 1.2 apps stay on golden-chess.com (they would be thrown out
  to the system browser).
- **Deploy** now = `node build.js`, copy dist/web/index.html + og.png to the root, push main here, **and** put the same
  published files into ukazyra-collab/joker-chess (the Claude GitHub app has no push access to that repo yet: either add
  it to the app's installation, github.com/settings/installations, or upload through github.com/…/upload/main).
- Supabase: Redirect URL https://joker-chess.com/** added (9 Nov). Site URL → https://joker-chess.com/ at the switch.
- Google Cloud OAuth client: authorised origin https://joker-chess.com and redirect URI
  https://joker-chess.com/google.html — needs the owner's sign-in (password) to the Cloud console.
- Later (when 1.2 apps are gone): golden-chess.com can become a GoDaddy forward, or keep the hand-over pages.
