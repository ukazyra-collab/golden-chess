#!/usr/bin/env python3
"""App Store Connect for Golden Chess, from the command line, with an App Store Connect API key — no PyPI packages (JWT signed with the
system's openssl). The key never leaves the machine: it is read from ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8 (where
altool looks too) or from ASC_KEY_PATH.

  export ASC_KEY_ID=XXXXXXXXXX ASC_ISSUER_ID=xxxxxxxx-xxxx-...        # from App Store Connect → Users and Access → Integrations → API
  python3 asc.py whoami                      the team's apps and whether the key works
  python3 asc.py bundle                      registers com.kozyramedia.goldenchess (with Push Notifications) if it is not there yet; prints the Team ID (seedId)
  python3 asc.py capability                  turns Sign in with Apple on for the bundle id (the App ID capability; the app's entitlements ask for it)
  python3 asc.py metadata                    app info, age rating, version 1.1, the English texts, the review details (listing.json)
  python3 asc.py screenshots DIR             uploads DIR/iphone67/*.png (1290x2796) and DIR/ipad129/*.png (2048x2732) to version 1.1
  python3 asc.py screens DIR                 how Apple's processing of each uploaded screenshot stands; a set with a failed or stuck one is uploaded again from DIR
  python3 asc.py build [--wait]              the newest build of 1.4: its state; --wait until Apple has processed it; attaches it to the version
  python3 asc.py submit                      sends version 1.1 to App Review
  python3 asc.py cancel                      takes the version back from the review queue (then metadata / screenshots / submit again)
  python3 asc.py status                      where the version stands
  python3 asc.py products                    Joker Pro for sale in the app (iap.json): the subscription group, the yearly plan (with its free week) and
                                             the monthly one, the Founder purchase, their prices in every country, texts, review screenshots, and where
                                             Apple sends its notifications. Only adds what is missing: run it again after a hiccup. Nothing is deleted.
  python3 asc.py products --check            the same look without changing anything

The app record itself (My Apps → + → New App) cannot be made through the API: Apple keeps that in the website. Everything after it can."""
import base64, hashlib, json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error, urllib.parse

API = 'https://api.appstoreconnect.apple.com'
BUNDLE = 'com.kozyramedia.goldenchess'; VERSION = os.environ.get('GC_VERSION', '1.1'); LOCALE = 'en-US'
HERE = os.path.dirname(os.path.abspath(__file__))

# ---- the token: ES256 JWT, signed by openssl (DER → raw r||s)
def b64u(b): return base64.urlsafe_b64encode(b).rstrip(b'=').decode()
def key_path():
    kid = os.environ.get('ASC_KEY_ID') or sys.exit('ASC_KEY_ID is not set')
    p = os.environ.get('ASC_KEY_PATH') or os.path.expanduser(f'~/.appstoreconnect/private_keys/AuthKey_{kid}.p8')
    if not os.path.exists(p): sys.exit(f'the key file is not at {p} — put the .p8 from App Store Connect there')
    return p
_tok = {'t': 0, 'v': ''}
def token():
    if time.time() - _tok['t'] < 15 * 60: return _tok['v']
    kid = os.environ['ASC_KEY_ID']; iss = os.environ.get('ASC_ISSUER_ID') or sys.exit('ASC_ISSUER_ID is not set')
    now = int(time.time()); head = b64u(json.dumps({'alg': 'ES256', 'kid': kid, 'typ': 'JWT'}).encode()); body = b64u(json.dumps({'iss': iss, 'iat': now, 'exp': now + 19 * 60, 'aud': 'appstoreconnect-v1'}).encode())
    msg = f'{head}.{body}'.encode()
    with tempfile.NamedTemporaryFile(delete=False) as f: f.write(msg); mp = f.name
    der = subprocess.check_output(['openssl', 'dgst', '-sha256', '-sign', key_path(), mp]); os.unlink(mp)
    # DER SEQUENCE { INTEGER r, INTEGER s } → 32-byte r || 32-byte s
    i = 2 if der[1] < 0x80 else 3; assert der[i] == 2; lr = der[i + 1]; r = der[i + 2:i + 2 + lr]; j = i + 2 + lr; assert der[j] == 2; ls = der[j + 1]; s = der[j + 2:j + 2 + ls]
    r = r.lstrip(b'\0').rjust(32, b'\0'); s = s.lstrip(b'\0').rjust(32, b'\0')
    _tok.update({'t': time.time(), 'v': f'{head}.{body}.{b64u(r + s)}'}); return _tok['v']

def api(method, path, body=None, raw=False):
    url = path if path.startswith('http') else API + path
    req = urllib.request.Request(url, method=method, headers={'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json', 'Accept': 'application/json'}, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: t = r.read(); return json.loads(t) if t and not raw else t
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors='replace'); sys.exit(f'{method} {path} → {e.code}: {msg[:6000]}')
def get_all(path):
    out = []; url = path
    while url:
        d = api('GET', url); out += d.get('data', []); url = (d.get('links') or {}).get('next')
    return out
def rel(t, i): return {'data': {'type': t, 'id': i}}

# ---- the app, the version
def app():
    d = api('GET', f'/v1/apps?filter[bundleId]={BUNDLE}&limit=1').get('data') or []
    if not d: sys.exit(f'no app with bundle id {BUNDLE} in App Store Connect yet — make it on the website: My Apps → + → New App (iOS, Golden Chess, English (U.S.), {BUNDLE}, SKU golden-chess), then run again')
    return d[0]
def version(create=True):
    a = app(); vs = api('GET', f"/v1/apps/{a['id']}/appStoreVersions?filter[platform]=IOS&filter[versionString]={VERSION}&limit=1").get('data') or []
    if vs: return a, vs[0]
    if not create: return a, None
    # App Store Connect makes a first version (1.0) together with the app record; a second one cannot be added while it is unreleased — rename it instead
    allv = api('GET', f"/v1/apps/{a['id']}/appStoreVersions?filter[platform]=IOS&limit=10").get('data') or []
    ed = [x for x in allv if (x['attributes'].get('appStoreState') or x['attributes'].get('appVersionState')) in ('PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY')]
    if ed:
        v = api('PATCH', f"/v1/appStoreVersions/{ed[0]['id']}", {'data': {'type': 'appStoreVersions', 'id': ed[0]['id'], 'attributes': {'versionString': VERSION}}})['data']
        print('version', ed[0]['attributes'].get('versionString'), 'renamed to', VERSION); return a, v
    v = api('POST', '/v1/appStoreVersions', {'data': {'type': 'appStoreVersions', 'attributes': {'platform': 'IOS', 'versionString': VERSION, 'releaseType': 'AFTER_APPROVAL'}, 'relationships': {'app': rel('apps', a['id'])}}})['data']
    print('version', VERSION, 'created'); return a, v

def cmd_whoami():
    apps = get_all('/v1/apps?limit=50'); print('the key works;', len(apps), 'apps:')
    for a in apps: print(' ', a['id'], a['attributes']['bundleId'], '·', a['attributes']['name'], '· sku', a['attributes'].get('sku'))

def cmd_bundle():
    d = api('GET', f'/v1/bundleIds?filter[identifier]={BUNDLE}&limit=1').get('data') or []
    if d: b = d[0]; print('bundle id registered:', b['attributes']['identifier'], 'team (seedId):', b['attributes'].get('seedId'))
    else:
        b = api('POST', '/v1/bundleIds', {'data': {'type': 'bundleIds', 'attributes': {'identifier': BUNDLE, 'name': 'Golden Chess', 'platform': 'IOS'}}})['data']; print('bundle id registered now:', BUNDLE, 'team (seedId):', b['attributes'].get('seedId'))
    print('TEAM_ID=' + str(b['attributes'].get('seedId')))

def cmd_capability():
    d = api('GET', f'/v1/bundleIds?filter[identifier]={BUNDLE}&limit=1').get('data') or sys.exit('run bundle first')
    bid = d[0]['id']
    have = {c['attributes'].get('capabilityType') for c in (api('GET', f'/v1/bundleIds/{bid}/bundleIdCapabilities').get('data') or [])}
    if 'APPLE_ID_AUTH' in have: print('Sign in with Apple is on already for', BUNDLE)
    else:
        api('POST', '/v1/bundleIdCapabilities', {'data': {'type': 'bundleIdCapabilities', 'attributes': {'capabilityType': 'APPLE_ID_AUTH',
            'settings': [{'key': 'APPLE_ID_AUTH_APP_CONSENT', 'options': [{'key': 'PRIMARY_APP_CONSENT'}]}]},
            'relationships': {'bundleId': rel('bundleIds', bid)}}})
        print('Sign in with Apple turned on for', BUNDLE, '(primary App ID)')
    # joker-chess.com links open the app (applinks:) — the App ID needs Associated Domains for the entitlement to sign
    if 'ASSOCIATED_DOMAINS' in have: print('Associated Domains is on already for', BUNDLE)
    else:
        api('POST', '/v1/bundleIdCapabilities', {'data': {'type': 'bundleIdCapabilities', 'attributes': {'capabilityType': 'ASSOCIATED_DOMAINS'},
            'relationships': {'bundleId': rel('bundleIds', bid)}}})
        print('Associated Domains turned on for', BUNDLE)

def cmd_metadata():
    L = json.load(open(os.path.join(HERE, 'listing.json'), encoding='utf-8'))
    a, v = version()
    # the app: content rights
    api('PATCH', f"/v1/apps/{a['id']}", {'data': {'type': 'apps', 'id': a['id'], 'attributes': {'contentRightsDeclaration': 'DOES_NOT_USE_THIRD_PARTY_CONTENT'}}})
    # app info: categories, the English name/subtitle/privacy policy
    infos = api('GET', f"/v1/apps/{a['id']}/appInfos").get('data') or []
    info = next((i for i in infos if i['attributes'].get('appStoreState') not in ('READY_FOR_SALE', 'REPLACED_WITH_NEW_INFO')), infos[0])
    api('PATCH', f"/v1/appInfos/{info['id']}", {'data': {'type': 'appInfos', 'id': info['id'], 'relationships': {'primaryCategory': rel('appCategories', 'GAMES'), 'primarySubcategoryOne': rel('appCategories', 'GAMES_BOARD'), 'primarySubcategoryTwo': rel('appCategories', 'GAMES_STRATEGY')}}})
    locs = api('GET', f"/v1/appInfos/{info['id']}/appInfoLocalizations").get('data') or []
    loc = next((l for l in locs if l['attributes']['locale'] == LOCALE), None)
    attrs = {'name': L['name'], 'subtitle': L['subtitle'], 'privacyPolicyUrl': L['privacyPolicyUrl']}
    if loc: api('PATCH', f"/v1/appInfoLocalizations/{loc['id']}", {'data': {'type': 'appInfoLocalizations', 'id': loc['id'], 'attributes': attrs}})
    else: api('POST', '/v1/appInfoLocalizations', {'data': {'type': 'appInfoLocalizations', 'attributes': dict(attrs, locale=LOCALE), 'relationships': {'appInfo': rel('appInfos', info['id'])}}})
    # age rating: nothing in it → 4+
    ar = api('GET', f"/v1/appInfos/{info['id']}/ageRatingDeclaration")['data']
    api('PATCH', f"/v1/ageRatingDeclarations/{ar['id']}", {'data': {'type': 'ageRatingDeclarations', 'id': ar['id'], 'attributes': {'alcoholTobaccoOrDrugUseOrReferences': 'NONE', 'contests': 'NONE', 'gamblingSimulated': 'NONE', 'horrorOrFearThemes': 'NONE', 'matureOrSuggestiveThemes': 'NONE', 'medicalOrTreatmentInformation': 'NONE', 'profanityOrCrudeHumor': 'NONE', 'sexualContentGraphicAndNudity': 'NONE', 'sexualContentOrNudity': 'NONE', 'violenceCartoonOrFantasy': 'NONE', 'violenceRealistic': 'NONE', 'violenceRealisticProlongedGraphicOrSadistic': 'NONE', 'gunsOrOtherWeapons': 'NONE', 'gambling': False, 'unrestrictedWebAccess': False, 'kidsAgeBand': None, 'lootBox': False, 'advertising': False, 'healthOrWellnessTopics': False, 'parentalControls': False, 'ageAssurance': False, 'messagingAndChat': False, 'userGeneratedContent': False, 'socialMedia': False, 'socialMediaAgeRestricted': False}}})
    print('app info: Games / Board, name, subtitle, privacy policy, age rating 4+')
    # the version's English texts
    vl = api('GET', f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations").get('data') or []
    loc = next((l for l in vl if l['attributes']['locale'] == LOCALE), None)
    attrs = {'description': L['description'], 'keywords': L['keywords'], 'supportUrl': L['supportUrl'], 'marketingUrl': L['marketingUrl'], 'promotionalText': L['promotionalText'], 'whatsNew': L['whatsNew']}
    # the first version of an app has no "What's New" — Apple refuses the attribute, so it goes in from the second version on
    rel_before = [x for x in (api('GET', f"/v1/apps/{a['id']}/appStoreVersions?filter[platform]=IOS&limit=20").get('data') or []) if x['id'] != v['id'] and (x['attributes'].get('appStoreState') or x['attributes'].get('appVersionState')) in ('READY_FOR_SALE', 'READY_FOR_DISTRIBUTION', 'REPLACED_WITH_NEW_VERSION', 'PROCESSING_FOR_APP_STORE', 'PENDING_DEVELOPER_RELEASE')]
    if not rel_before: attrs.pop('whatsNew'); print('first release: no What\'s New')
    if loc: api('PATCH', f"/v1/appStoreVersionLocalizations/{loc['id']}", {'data': {'type': 'appStoreVersionLocalizations', 'id': loc['id'], 'attributes': attrs}})
    else: api('POST', '/v1/appStoreVersionLocalizations', {'data': {'type': 'appStoreVersionLocalizations', 'attributes': dict(attrs, locale=LOCALE), 'relationships': {'appStoreVersion': rel('appStoreVersions', v['id'])}}})
    api('PATCH', f"/v1/appStoreVersions/{v['id']}", {'data': {'type': 'appStoreVersions', 'id': v['id'], 'attributes': {'copyright': L.get('copyright', '2026 Kozyra Media Group')}}})
    print('version texts: description, keywords, urls, what\'s new, copyright')
    # the review details: contact, demo account, notes
    R = L['review']
    rd = api('GET', f"/v1/appStoreVersions/{v['id']}/appStoreReviewDetail").get('data')
    # a new version starts with the review details of the one before it: when App Store Connect already holds the demo
    # account, only the notes are written and the sign-in stays as it is (GC_REVIEW_RESET=1 writes it all again)
    if rd and (rd.get('attributes') or {}).get('demoAccountName') and not os.environ.get('GC_REVIEW_RESET'):
        api('PATCH', f"/v1/appStoreReviewDetails/{rd['id']}", {'data': {'type': 'appStoreReviewDetails', 'id': rd['id'], 'attributes': {'notes': R['notes']}}})
        print('review details: notes (contact and demo account kept as they are)'); return
    # the contact and the demo account come from the environment, never from the repository (it is public)
    pw = os.environ.get('GC_REVIEW_PASSWORD') or sys.exit('GC_REVIEW_PASSWORD (the demo account\'s password) is not set')
    need = lambda k: os.environ.get(k) or sys.exit(f'{k} is not set')
    attrs = {'contactFirstName': R['firstName'], 'contactLastName': R['lastName'], 'contactPhone': need('GC_REVIEW_PHONE'), 'contactEmail': need('GC_REVIEW_EMAIL'), 'demoAccountName': need('GC_REVIEW_ACCOUNT'), 'demoAccountPassword': pw, 'demoAccountRequired': True, 'notes': R['notes']}
    if rd: api('PATCH', f"/v1/appStoreReviewDetails/{rd['id']}", {'data': {'type': 'appStoreReviewDetails', 'id': rd['id'], 'attributes': attrs}})
    else: api('POST', '/v1/appStoreReviewDetails', {'data': {'type': 'appStoreReviewDetails', 'attributes': attrs, 'relationships': {'appStoreVersion': rel('appStoreVersions', v['id'])}}})
    print('review details: contact, demo account, notes')

SETS = {'iphone67': 'APP_IPHONE_67', 'ipad129': 'APP_IPAD_PRO_3GEN_129'}
def cmd_screenshots(d):
    a, v = version(); vl = api('GET', f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations").get('data') or []
    loc = next((l for l in vl if l['attributes']['locale'] == LOCALE), None) or sys.exit('run metadata first (the English localization)')
    sets = api('GET', f"/v1/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets").get('data') or []
    for sub, kind in SETS.items():
        folder = os.path.join(d, sub); files = sorted(f for f in os.listdir(folder) if f.lower().endswith('.png')) if os.path.isdir(folder) else []
        if not files: print(sub, 'no files'); continue
        st = next((s for s in sets if s['attributes']['screenshotDisplayType'] == kind), None)
        if not st: st = api('POST', '/v1/appScreenshotSets', {'data': {'type': 'appScreenshotSets', 'attributes': {'screenshotDisplayType': kind}, 'relationships': {'appStoreVersionLocalization': rel('appStoreVersionLocalizations', loc['id'])}}})['data']
        have = api('GET', f"/v1/appScreenshotSets/{st['id']}/appScreenshots").get('data') or []
        for s in have: api('DELETE', f"/v1/appScreenshots/{s['id']}")   # the set is replaced whole, in our order
        for f in files: upload_screenshot(st, folder, f); print(sub, f, 'uploaded')
    print('screenshots done')

def upload_screenshot(st, folder, f):
    data = open(os.path.join(folder, f), 'rb').read()
    sc = api('POST', '/v1/appScreenshots', {'data': {'type': 'appScreenshots', 'attributes': {'fileName': f, 'fileSize': len(data)}, 'relationships': {'appScreenshotSet': rel('appScreenshotSets', st['id'])}}})['data']
    for op in sc['attributes']['uploadOperations']:
        chunk = data[op['offset']:op['offset'] + op['length']]
        req = urllib.request.Request(op['url'], method=op['method'], data=chunk, headers={h['name']: h['value'] for h in op['requestHeaders']})
        with urllib.request.urlopen(req, timeout=300) as r: r.read()
    api('PATCH', f"/v1/appScreenshots/{sc['id']}", {'data': {'type': 'appScreenshots', 'id': sc['id'], 'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()}}})

# where each uploaded screenshot stands (AWAITING_UPLOAD / UPLOAD_COMPLETE / COMPLETE / FAILED, with Apple's reason). `submit` is
# refused while any is unfinished; a set with a FAILED or stuck one is replaced whole from DIR (deleted, uploaded again in order)
def cmd_screens(d, fix=True):
    a, v = version(create=False); v or sys.exit('no version')
    vl = api('GET', f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations").get('data') or []
    loc = next((l for l in vl if l['attributes']['locale'] == LOCALE), None) or sys.exit('no English localization')
    sets = api('GET', f"/v1/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets").get('data') or []
    bad = 0
    for st in sets:
        kind = st['attributes']['screenshotDisplayType']; sub = next((k for k, t in SETS.items() if t == kind), None)
        shots = api('GET', f"/v1/appScreenshotSets/{st['id']}/appScreenshots").get('data') or []; unfinished = []
        for s in shots:
            at = s['attributes']; ds = at.get('assetDeliveryState') or {}; state = ds.get('state'); errs = ds.get('errors') or []
            print(kind, at.get('fileName'), state, '; '.join(e.get('description') or e.get('code') or '' for e in errs))
            if state not in ('COMPLETE', 'UPLOAD_COMPLETE'): unfinished.append(s)
        bad += len(unfinished)
        folder = sub and os.path.join(d, sub); files = sorted(f for f in os.listdir(folder) if f.lower().endswith('.png')) if folder and os.path.isdir(folder) else []
        if unfinished and fix and files:
            for s in shots: api('DELETE', f"/v1/appScreenshots/{s['id']}")
            for f in files: upload_screenshot(st, folder, f); print(' ', sub, f, 'uploaded again')
    print('unfinished screenshots:', bad)

def cmd_build(wait=False):
    a, v = version()
    while True:
        bs = api('GET', f"/v1/builds?filter[app]={a['id']}&filter[preReleaseVersion.version]={VERSION}&sort=-uploadedDate&limit=5").get('data') or []
        want = os.environ.get('GC_BUILD')  # wait for this build number (a fresh upload shows up a few minutes late)
        if want: bs = [x for x in bs if x['attributes']['version'] == want]
        if bs:
            b = bs[0]; st = b['attributes']['processingState']; print('build', b['attributes']['version'], st, b['attributes'].get('uploadedDate'))
            if st == 'VALID':
                if b['attributes'].get('usesNonExemptEncryption') is None: api('PATCH', f"/v1/builds/{b['id']}", {'data': {'type': 'builds', 'id': b['id'], 'attributes': {'usesNonExemptEncryption': False}}})
                api('PATCH', f"/v1/appStoreVersions/{v['id']}/relationships/build", rel('builds', b['id'])); print('attached to version', VERSION); return
            if st in ('FAILED', 'INVALID'): sys.exit('the build failed processing — look at the e-mail from App Store Connect')
        else: print('no build of', VERSION, 'uploaded yet')
        if not wait: return
        time.sleep(60)

def cmd_submit():
    a, v = version(create=False) ; v or sys.exit('no version')
    subs = api('GET', f"/v1/reviewSubmissions?filter[app]={a['id']}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW&limit=5").get('data') or []
    sub = subs[0] if subs else api('POST', '/v1/reviewSubmissions', {'data': {'type': 'reviewSubmissions', 'attributes': {'platform': 'IOS'}, 'relationships': {'app': rel('apps', a['id'])}}})['data']
    # screenshots are post-processed for a few minutes after the upload; adding the version and submitting are refused until they are done — wait and retry
    # (up to an hour; `screens` shows which screenshot Apple is still chewing on, or has rejected)
    for attempt in range(60):
        try:
            items = api('GET', f"/v1/reviewSubmissions/{sub['id']}/items").get('data') or []
            if not items: api('POST', '/v1/reviewSubmissionItems', {'data': {'type': 'reviewSubmissionItems', 'relationships': {'reviewSubmission': rel('reviewSubmissions', sub['id']), 'appStoreVersion': rel('appStoreVersions', v['id'])}}})
            api('PATCH', f"/v1/reviewSubmissions/{sub['id']}", {'data': {'type': 'reviewSubmissions', 'id': sub['id'], 'attributes': {'submitted': True}}}); break
        except SystemExit as e:
            if ('ASSET_IN_POST_PROCESSING' in str(e) or 'being processed' in str(e)) and attempt < 59: print('assets still processing — waiting a minute', flush=True); time.sleep(60)
            else: raise
    print('submitted for review:', VERSION)

# take the version back from the review queue (Waiting for Review / In Review): its texts and screenshots can then be
# changed, and `submit` sends it again
def cmd_cancel():
    a = app()
    subs = api('GET', f"/v1/reviewSubmissions?filter[app]={a['id']}&filter[state]=WAITING_FOR_REVIEW,IN_REVIEW,READY_FOR_REVIEW,UNRESOLVED_ISSUES&limit=5").get('data') or []
    if not subs: print('nothing in review'); return
    for sub in subs:
        api('PATCH', f"/v1/reviewSubmissions/{sub['id']}", {'data': {'type': 'reviewSubmissions', 'id': sub['id'], 'attributes': {'canceled': True}}})
        print('taken back from review:', sub['attributes']['state'], sub['attributes'].get('submittedDate'))
    time.sleep(5)

def cmd_status():
    a, v = version(create=False)
    print(a['attributes']['name'], a['attributes']['bundleId']); print('version', VERSION, '→', v['attributes'].get('appStoreState') or v['attributes'].get('appVersionState') if v else 'not created')
    if v:
        b = api('GET', f"/v1/appStoreVersions/{v['id']}/build").get('data'); print('build attached:', b['attributes']['version'] if b else 'none')
    for s in api('GET', f"/v1/reviewSubmissions?filter[app]={a['id']}&limit=3").get('data') or []: print('submission', s['attributes']['state'], s['attributes'].get('submittedDate'))

# ---- Joker Pro for sale in the app: App Store Connect's side (the products themselves; iap.json says what they are)
def soft(method, path, body=None):
    """api() that answers (ok, data | Apple's words) instead of stopping; waits and tries again when Apple is busy"""
    for attempt in range(6):
        try: return True, api(method, path, body)
        except SystemExit as e:
            msg = str(e)
            if ('→ 429' in msg or '→ 500' in msg or '→ 502' in msg or '→ 503' in msg or '→ 504' in msg) and attempt < 5: time.sleep(20 * (attempt + 1)); continue
            return False, msg
def money(x):
    try: return round(float(x), 2)
    except Exception: return None
def terr_of(x): return (((x.get('relationships') or {}).get('territory') or {}).get('data') or {}).get('id')
def upload_asset(res, path_data):
    """the bytes of a file Apple has made room for (res: the created screenshot resource), then the word that they are in"""
    for op in res['attributes']['uploadOperations']:
        chunk = path_data[op['offset']:op['offset'] + op['length']]
        req = urllib.request.Request(op['url'], method=op['method'], data=chunk, headers={h['name']: h['value'] for h in op['requestHeaders']})
        with urllib.request.urlopen(req, timeout=300) as r: r.read()

def cmd_products(check=False):
    P = json.load(open(os.path.join(HERE, 'iap.json'), encoding='utf-8'))
    a = app(); aid = a['id']; todo = []
    def do(what): print(('would: ' if check else '') + what, flush=True); todo.append(what)
    terrs = [t['id'] for t in get_all('/v1/territories?limit=200')]; print(len(terrs), 'countries and regions in the App Store')
    # 1. the group, and its name in each language
    groups = get_all(f"/v1/apps/{aid}/subscriptionGroups?limit=50")
    g = next((x for x in groups if x['attributes']['referenceName'] == P['group']['referenceName']), None)
    if not g:
        do('subscription group ' + P['group']['referenceName'])
        if not check: g = api('POST', '/v1/subscriptionGroups', {'data': {'type': 'subscriptionGroups', 'attributes': {'referenceName': P['group']['referenceName']}, 'relationships': {'app': rel('apps', aid)}}})['data']
    if g:
        have = {l['attributes']['locale'] for l in get_all(f"/v1/subscriptionGroups/{g['id']}/subscriptionGroupLocalizations?limit=50")}
        for loc, t in P['group']['localizations'].items():
            if loc in have: continue
            do(f'group name ({loc})')
            if not check:
                ok, r = soft('POST', '/v1/subscriptionGroupLocalizations', {'data': {'type': 'subscriptionGroupLocalizations', 'attributes': {'name': t['name'], 'locale': loc}, 'relationships': {'subscriptionGroup': rel('subscriptionGroups', g['id'])}}})
                if not ok: print('  refused:', r[:400])
    # 2. the subscriptions
    subs = {s['attributes']['productId']: s for s in (get_all(f"/v1/subscriptionGroups/{g['id']}/subscriptions?limit=50") if g else [])}
    for sp in P['subscriptions']:
        pid = sp['productId']; s = subs.get(pid)
        if not s:
            do(f"subscription {pid} ({sp['period']}, level {sp['groupLevel']})")
            if check: continue
            s = api('POST', '/v1/subscriptions', {'data': {'type': 'subscriptions', 'attributes': {'name': sp['referenceName'], 'productId': pid, 'familySharable': False, 'subscriptionPeriod': sp['period'], 'groupLevel': sp['groupLevel'], 'reviewNote': P['reviewNote']},
                'relationships': {'group': rel('subscriptionGroups', g['id'])}}})['data']
        sid = s['id']
        have = {l['attributes']['locale'] for l in get_all(f"/v1/subscriptions/{sid}/subscriptionLocalizations?limit=50")}
        for loc, t in sp['localizations'].items():
            if loc in have: continue
            do(f'{pid}: name and description ({loc})')
            if not check:
                ok, r = soft('POST', '/v1/subscriptionLocalizations', {'data': {'type': 'subscriptionLocalizations', 'attributes': {'name': t['name'], 'description': t['description'], 'locale': loc}, 'relationships': {'subscription': rel('subscriptions', sid)}}})
                if not ok: print('  refused:', r[:400])
        # where it is sold: everywhere, and in the countries Apple adds later
        ok, av = soft('GET', f"/v1/subscriptions/{sid}/subscriptionAvailability")
        if not (ok and av.get('data')):
            do(f'{pid}: on sale in all {len(terrs)} countries')
            if not check:
                ok, r = soft('POST', '/v1/subscriptionAvailabilities', {'data': {'type': 'subscriptionAvailabilities', 'attributes': {'availableInNewTerritories': True},
                    'relationships': {'subscription': rel('subscriptions', sid), 'availableTerritories': {'data': [{'type': 'territories', 'id': t} for t in terrs]}}}})
                if not ok: print('  refused:', r[:400])
        # the price: the dollar one, and Apple's own match for it in every other country
        priced = {terr_of(x) for x in get_all(f"/v1/subscriptions/{sid}/prices?include=territory&limit=200")}
        missing = [t for t in terrs if t not in priced]
        if missing:
            do(f"{pid}: the price, ${sp['usd']} and its match in {len(missing)} countries")
            if not check:
                pts = get_all(f"/v1/subscriptions/{sid}/pricePoints?filter[territory]=USA&limit=200")
                base = next((x for x in pts if money(x['attributes'].get('customerPrice')) == money(sp['usd'])), None) or sys.exit(f"no ${sp['usd']} price point for {pid} in the USA")
                eq = {terr_of(x): x['id'] for x in get_all(f"/v1/subscriptionPricePoints/{base['id']}/equalizations?include=territory&limit=200")}; eq['USA'] = base['id']
                done = bad = 0
                for t in ['USA'] + [x for x in missing if x != 'USA']:
                    if t not in missing: continue
                    if t not in eq: print('  no matching price for', t); bad += 1; continue
                    ok, r = soft('POST', '/v1/subscriptionPrices', {'data': {'type': 'subscriptionPrices', 'relationships': {'subscription': rel('subscriptions', sid), 'territory': rel('territories', t), 'subscriptionPricePoint': rel('subscriptionPricePoints', eq[t])}}})
                    if ok: done += 1
                    else: bad += 1; print('  price refused for', t, r[:300])
                    if done % 25 == 0 and ok: print('  ', done, 'prices set', flush=True)
                print(f'  {pid}: {done} prices set, {bad} not')
        # the free week for those who have not had one (Apple checks who may have it)
        if sp.get('trial'):
            offered = {terr_of(x) for x in get_all(f"/v1/subscriptions/{sid}/introductoryOffers?include=territory&limit=200")}
            missing = [t for t in terrs if t not in offered]
            if missing:
                do(f"{pid}: the free trial ({sp['trial']}) in {len(missing)} countries")
                if not check:
                    done = bad = 0
                    for t in missing:
                        ok, r = soft('POST', '/v1/subscriptionIntroductoryOffers', {'data': {'type': 'subscriptionIntroductoryOffers', 'attributes': {'duration': sp['trial'], 'offerMode': 'FREE_TRIAL', 'numberOfPeriods': 1},
                            'relationships': {'subscription': rel('subscriptions', sid), 'territory': rel('territories', t)}}})
                        if ok: done += 1
                        else:
                            bad += 1; print('  trial refused for', t, r[:300])
                            if bad >= 5 and not done: print('  (stopping: Apple refuses them all)'); break
                        if done % 25 == 0 and ok: print('  ', done, 'trials set', flush=True)
                    print(f'  {pid}: the trial set in {done} countries, {bad} not')
        # the picture for App Review
        ok, sh = soft('GET', f"/v1/subscriptions/{sid}/appStoreReviewScreenshot")
        if not (ok and sh.get('data')):
            do(f"{pid}: the review screenshot ({sp['screenshot']})")
            if not check:
                data = open(os.path.join(HERE, sp['screenshot']), 'rb').read()
                ok, r = soft('POST', '/v1/subscriptionAppStoreReviewScreenshots', {'data': {'type': 'subscriptionAppStoreReviewScreenshots', 'attributes': {'fileName': pid + '.png', 'fileSize': len(data)}, 'relationships': {'subscription': rel('subscriptions', sid)}}})
                if ok:
                    upload_asset(r['data'], data)
                    api('PATCH', f"/v1/subscriptionAppStoreReviewScreenshots/{r['data']['id']}", {'data': {'type': 'subscriptionAppStoreReviewScreenshots', 'id': r['data']['id'], 'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()}}})
                else: print('  refused:', r[:400])
    # 3. Founder: bought once, kept for good
    F = P['founder']; iaps = {x['attributes']['productId']: x for x in get_all(f"/v1/apps/{aid}/inAppPurchasesV2?limit=50")}; f = iaps.get(F['productId'])
    if not f:
        do(f"in-app purchase {F['productId']} (non-consumable)")
        if not check:
            f = api('POST', '/v2/inAppPurchases', {'data': {'type': 'inAppPurchases', 'attributes': {'name': F['referenceName'], 'productId': F['productId'], 'inAppPurchaseType': 'NON_CONSUMABLE', 'familySharable': False, 'reviewNote': P['reviewNote']},
                'relationships': {'app': rel('apps', aid)}}})['data']
    if f:
        fid = f['id']; pid = F['productId']
        have = {l['attributes']['locale'] for l in get_all(f"/v2/inAppPurchases/{fid}/inAppPurchaseLocalizations?limit=50")}
        for loc, t in F['localizations'].items():
            if loc in have: continue
            do(f'{pid}: name and description ({loc})')
            if not check:
                ok, r = soft('POST', '/v1/inAppPurchaseLocalizations', {'data': {'type': 'inAppPurchaseLocalizations', 'attributes': {'name': t['name'], 'description': t['description'], 'locale': loc}, 'relationships': {'inAppPurchaseV2': rel('inAppPurchases', fid)}}})
                if not ok: print('  refused:', r[:400])
        ok, av = soft('GET', f"/v2/inAppPurchases/{fid}/inAppPurchaseAvailability")
        if not (ok and av.get('data')):
            do(f'{pid}: on sale in all {len(terrs)} countries')
            if not check:
                ok, r = soft('POST', '/v1/inAppPurchaseAvailabilities', {'data': {'type': 'inAppPurchaseAvailabilities', 'attributes': {'availableInNewTerritories': True},
                    'relationships': {'inAppPurchase': rel('inAppPurchases', fid), 'availableTerritories': {'data': [{'type': 'territories', 'id': t} for t in terrs]}}}})
                if not ok: print('  refused:', r[:400])
        ok, ps = soft('GET', f"/v2/inAppPurchases/{fid}/iapPriceSchedule?include=manualPrices")
        if not (ok and (((ps.get('data') or {}).get('relationships') or {}).get('manualPrices') or {}).get('data')):
            do(f"{pid}: the price, ${F['usd']} (Apple matches it in the other countries)")
            if not check:
                pts = get_all(f"/v2/inAppPurchases/{fid}/pricePoints?filter[territory]=USA&limit=200")
                base = next((x for x in pts if money(x['attributes'].get('customerPrice')) == money(F['usd'])), None) or sys.exit(f"no ${F['usd']} price point for {pid} in the USA")
                ok, r = soft('POST', '/v1/inAppPurchasePriceSchedules', {'data': {'type': 'inAppPurchasePriceSchedules', 'relationships': {'inAppPurchase': rel('inAppPurchases', fid), 'baseTerritory': rel('territories', 'USA'),
                    'manualPrices': {'data': [{'type': 'inAppPurchasePrices', 'id': '${p1}'}]}}},
                    'included': [{'type': 'inAppPurchasePrices', 'id': '${p1}', 'attributes': {'startDate': None}, 'relationships': {'inAppPurchaseV2': rel('inAppPurchases', fid), 'inAppPurchasePricePoint': rel('inAppPurchasePricePoints', base['id'])}}]})
                if not ok: print('  refused:', r[:600])
        ok, sh = soft('GET', f"/v2/inAppPurchases/{fid}/appStoreReviewScreenshot")
        if not (ok and sh.get('data')):
            do(f"{pid}: the review screenshot ({F['screenshot']})")
            if not check:
                data = open(os.path.join(HERE, F['screenshot']), 'rb').read()
                ok, r = soft('POST', '/v1/inAppPurchaseAppStoreReviewScreenshots', {'data': {'type': 'inAppPurchaseAppStoreReviewScreenshots', 'attributes': {'fileName': pid + '.png', 'fileSize': len(data)}, 'relationships': {'inAppPurchaseV2': rel('inAppPurchases', fid)}}})
                if ok:
                    upload_asset(r['data'], data)
                    api('PATCH', f"/v1/inAppPurchaseAppStoreReviewScreenshots/{r['data']['id']}", {'data': {'type': 'inAppPurchaseAppStoreReviewScreenshots', 'id': r['data']['id'], 'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()}}})
                else: print('  refused:', r[:400])
    # 4. where Apple sends its news of renewals, cancellations and refunds (App Store Server Notifications, version 2)
    at = api('GET', f"/v1/apps/{aid}?fields[apps]=subscriptionStatusUrl,subscriptionStatusUrlVersion,subscriptionStatusUrlForSandbox,subscriptionStatusUrlVersionForSandbox")['data']['attributes']
    want = {'subscriptionStatusUrl': P['statusUrl'], 'subscriptionStatusUrlVersion': 'V2', 'subscriptionStatusUrlForSandbox': P['statusUrl'], 'subscriptionStatusUrlVersionForSandbox': 'V2'}
    if any(at.get(k) != v for k, v in want.items()):
        do('server notifications (production and sandbox) → ' + P['statusUrl'])
        if not check:
            ok, r = soft('PATCH', f"/v1/apps/{aid}", {'data': {'type': 'apps', 'id': aid, 'attributes': want}})
            if not ok: print('  refused:', r[:400])
    # 5. where it all stands
    print('--- now')
    if g:
        for s in get_all(f"/v1/subscriptionGroups/{g['id']}/subscriptions?limit=50"):
            sid = s['id']; n = len(get_all(f"/v1/subscriptions/{sid}/prices?limit=200")); o = len(get_all(f"/v1/subscriptions/{sid}/introductoryOffers?limit=200"))
            print('subscription', s['attributes']['productId'], '·', s['attributes']['state'], '· level', s['attributes'].get('groupLevel'), '· prices in', n, 'countries · trial in', o)
    for x in get_all(f"/v1/apps/{aid}/inAppPurchasesV2?limit=50"): print('in-app purchase', x['attributes']['productId'], '·', x['attributes']['state'])
    at = api('GET', f"/v1/apps/{aid}?fields[apps]=subscriptionStatusUrl,subscriptionStatusUrlVersion,subscriptionStatusUrlForSandbox,subscriptionStatusUrlVersionForSandbox")['data']['attributes']
    print('notifications:', at.get('subscriptionStatusUrlVersion'), at.get('subscriptionStatusUrl'), '· sandbox:', at.get('subscriptionStatusUrlVersionForSandbox'), at.get('subscriptionStatusUrlForSandbox'))
    print(('nothing to do' if not todo else str(len(todo)) + ' steps ' + ('to do' if check else 'done')) + '. The first purchases go to review together with an app version: App Store Connect → the version → In-App Purchases and Subscriptions → select them.')

if __name__ == '__main__':
    c = sys.argv[1] if len(sys.argv) > 1 else 'help'
    if c == 'whoami': cmd_whoami()
    elif c == 'bundle': cmd_bundle()
    elif c == 'capability': cmd_capability()
    elif c == 'metadata': cmd_metadata()
    elif c == 'screenshots': cmd_screenshots(sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'store', 'appstore'))
    elif c == 'screens': cmd_screens(sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'store', 'appstore'), fix='--no-fix' not in sys.argv)
    elif c == 'build': cmd_build('--wait' in sys.argv)
    elif c == 'submit': cmd_submit()
    elif c == 'cancel': cmd_cancel()
    elif c == 'status': cmd_status()
    elif c == 'products': cmd_products(check='--check' in sys.argv)
    else: print(__doc__)
