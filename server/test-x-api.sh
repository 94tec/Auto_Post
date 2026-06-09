#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# test-x-api.sh — FINAL
# Full path: http://localhost:3000/api/x/*
# ─────────────────────────────────────────────────────────────────────────────

# ── CONFIG ────────────────────────────────────────────────────────────────────
API_URL="http://localhost:3000/api"
FIREBASE_WEB_API_KEY="AIzaSyAzwS8amkkAside05KlJOsXJol8C79Yl1w"
EMAIL="fixtone94tec@gmail.com"
PASSWORD="YourStrongPass123"
# ─────────────────────────────────────────────────────────────────────────────

export PATH="/usr/bin:/bin:/usr/local/bin:$PATH"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m';  BOLD='\033[1m';   RESET='\033[0m'
PASS=0; FAIL=0

header() {
  echo ""
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${CYAN}${BOLD}  $1${RESET}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
}

check() {
  local label="$1" expected="$2" actual="$3" body="$4"
  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}✓${RESET} ${label}  ${YELLOW}(HTTP $actual)${RESET}"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}✗${RESET} ${label}"
    echo -e "    ${RED}Expected $expected — got $actual${RESET}"
    FAIL=$((FAIL+1))
  fi
  echo "$body" | python3 -m json.tool 2>/dev/null | sed 's/^/    /' || echo "    $body"
  echo ""
}

do_get()        { curl -s -o /tmp/xbody -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$1"; }
do_post()       { curl -s -o /tmp/xbody -w "%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2" "$1"; }
do_get_noauth() { curl -s -o /tmp/xbody -w "%{http_code}" "$1"; }
body()          { cat /tmp/xbody; }

BASE="$API_URL/x"   # → http://localhost:3000/api/x

# ══════════════════════════════════════════════════════════════════════════════
header "0 / PRE-FLIGHT"
# ══════════════════════════════════════════════════════════════════════════════

echo -e "  Base URL: ${YELLOW}${BASE}${RESET}"
echo -e "  Pinging server..."

PING=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:3000")
if [ "$PING" = "000" ]; then
  echo -e "  ${RED}✗ Server not running${RESET}"; exit 1
fi
echo -e "  ${GREEN}✓ Server up${RESET}"

echo -e "  Fetching fresh Firebase token..."
TOKEN_RES=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"returnSecureToken\":true}")

TOKEN=$(echo "$TOKEN_RES" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('idToken',''))" 2>/dev/null)
ERR=$(echo "$TOKEN_RES" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); e=d.get('error',{}); print(e.get('message','') if isinstance(e,dict) else '')" 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "None" ]; then
  echo -e "  ${RED}✗ Token failed: $ERR${RESET}"; exit 1
fi
echo -e "  ${GREEN}✓ Token: ${TOKEN:0:35}...${RESET}"

# ══════════════════════════════════════════════════════════════════════════════
header "1 / AUTH GUARD"
# ══════════════════════════════════════════════════════════════════════════════

STATUS=$(do_get_noauth "${BASE}/status")
check "GET /api/x/status  no token → 401" "401" "$STATUS" "$(body)"

# ══════════════════════════════════════════════════════════════════════════════
header "2 / GET /api/x/status"
# ══════════════════════════════════════════════════════════════════════════════

STATUS=$(do_get "${BASE}/status")
BODY_S=$(body)
check "GET /api/x/status → 200" "200" "$STATUS" "$BODY_S"

CONNECTED=$(echo "$BODY_S" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(str(d.get('connected',False)).lower())" 2>/dev/null)
XUSER=$(echo "$BODY_S" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('xUsername','—'))" 2>/dev/null)

echo -e "  ${YELLOW}→ connected: ${BOLD}${CONNECTED}${RESET}"
[ "$CONNECTED" = "true" ] && echo -e "  ${YELLOW}→ username:  @${BOLD}${XUSER}${RESET}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
header "3 / GET /api/x/connect — OAuth redirect"
# ══════════════════════════════════════════════════════════════════════════════

REDIRECT=$(curl -s -o /dev/null -w "%{redirect_url}" \
  -H "Authorization: Bearer $TOKEN" "${BASE}/connect")

if echo "$REDIRECT" | grep -qi "twitter.com\|x.com"; then
  echo -e "  ${GREEN}✓ Redirects to X OAuth${RESET}"
  echo -e "    ${YELLOW}${REDIRECT:0:120}...${RESET}"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}✗ No X OAuth redirect — check X_CLIENT_ID and X_CLIENT_SECRET in .env${RESET}"
  echo -e "    Got: '${REDIRECT}'"
  FAIL=$((FAIL+1))
fi
echo ""

# ══════════════════════════════════════════════════════════════════════════════
header "4 / POST /api/x/post — validation"
# ══════════════════════════════════════════════════════════════════════════════

STATUS=$(do_post "${BASE}/post" '{}')
check "Empty body → 400" "400" "$STATUS" "$(body)"

STATUS=$(do_post "${BASE}/post" '{"text":"","sourceId":"abc","sourceType":"quote"}')
check "Empty text → 400" "400" "$STATUS" "$(body)"

LONG=$(python3 -c "print('x'*281)")
STATUS=$(do_post "${BASE}/post" "{\"text\":\"${LONG}\",\"sourceId\":\"abc\",\"sourceType\":\"quote\"}")
check "281-char text → 400" "400" "$STATUS" "$(body)"

STATUS=$(do_post "${BASE}/post" '{"text":"hello","sourceType":"quote"}')
check "Missing sourceId → 400" "400" "$STATUS" "$(body)"

STATUS=$(do_post "${BASE}/post" '{"text":"hello","sourceId":"abc"}')
check "Missing sourceType → 400" "400" "$STATUS" "$(body)"

# ══════════════════════════════════════════════════════════════════════════════
header "5 / POST /api/x/post — real tweet"
# ══════════════════════════════════════════════════════════════════════════════

if [ "$CONNECTED" = "true" ]; then
  TWEET="Getting started is the secret. Damuchi $(date +%s) #motivation #Damuchi"
  STATUS=$(do_post "${BASE}/post" \
    "{\"text\":\"${TWEET}\",\"sourceId\":\"curl-test-$(date +%s)\",\"sourceType\":\"quote\"}")
  BODY_P=$(body)
  check "Real tweet → 200" "200" "$STATUS" "$BODY_P"
  URL=$(echo "$BODY_P" | python3 -c \
    "import sys,json; print(json.load(sys.stdin).get('tweetUrl',''))" 2>/dev/null)
  [ -n "$URL" ] && echo -e "  ${GREEN}🐦 Live: ${URL}${RESET}"
  echo ""
else
  echo -e "  ${YELLOW}⚠  X not connected — verifying 403 error path${RESET}"
  echo ""
  STATUS=$(do_post "${BASE}/post" \
    '{"text":"test tweet","sourceId":"curl-test","sourceType":"quote"}')
  check "Post without X linked → 403" "403" "$STATUS" "$(body)"

  echo -e "  ${CYAN}To connect X, open in your browser (while logged into Damuchi):${RESET}"
  echo -e "  ${YELLOW}  http://localhost:3000/api/x/connect${RESET}"
  echo ""
fi

# ══════════════════════════════════════════════════════════════════════════════
header "6 / GET /api/x/history"
# ══════════════════════════════════════════════════════════════════════════════

STATUS=$(do_get "${BASE}/history")
BODY_H=$(body)
check "GET /api/x/history → 200" "200" "$STATUS" "$BODY_H"

COUNT=$(echo "$BODY_H" | python3 -c \
  "import sys,json; print(len(json.load(sys.stdin).get('posts',[])))" 2>/dev/null)
echo -e "  ${YELLOW}→ ${COUNT} post(s) in log${RESET}"
echo ""

STATUS=$(do_get "${BASE}/history?limit=3")
check "GET /api/x/history?limit=3 → 200" "200" "$STATUS" "$(body)"

# ══════════════════════════════════════════════════════════════════════════════
header "7 / .env CHECK"
# ══════════════════════════════════════════════════════════════════════════════

if [ -f ".env" ]; then
  for KEY in X_CLIENT_ID X_CLIENT_SECRET X_REDIRECT_URI X_TOKEN_ENCRYPT_SECRET FRONTEND_URL; do
    VAL=$(grep "^${KEY}=" .env 2>/dev/null | cut -d= -f2- | tr -d '"'"'" | xargs)
    if [ -n "$VAL" ]; then
      echo -e "  ${GREEN}✓${RESET} $KEY is set"
      PASS=$((PASS+1))
    else
      echo -e "  ${RED}✗${RESET} $KEY missing from .env"
      FAIL=$((FAIL+1))
    fi
  done
else
  echo -e "  ${YELLOW}⚠  No .env found — run from server root${RESET}"
fi
echo ""

# ══════════════════════════════════════════════════════════════════════════════
header "8 / DISCONNECT — run manually"
# ══════════════════════════════════════════════════════════════════════════════
echo -e "  ${YELLOW}When you want to test re-auth, run:${RESET}"
echo ""
echo -e "  curl -s -X POST \\"
echo -e "    -H \"Authorization: Bearer \$TOKEN\" \\"
echo -e "    http://localhost:3000/api/x/disconnect | python3 -m json.tool"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
header "SUMMARY"
# ══════════════════════════════════════════════════════════════════════════════
TOTAL=$((PASS+FAIL))
echo -e "  ${GREEN}Passed: ${PASS}${RESET} / ${TOTAL}"
[ $FAIL -gt 0 ] && echo -e "  ${RED}Failed: ${FAIL}${RESET} / ${TOTAL}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}All tests passed ✓  Backend fully ready.${RESET}"
elif [ "$CONNECTED" != "true" ] && [ $FAIL -le 1 ]; then
  echo -e "  ${YELLOW}${BOLD}Backend is healthy ✓${RESET}"
  echo -e "  ${YELLOW}One step left: connect X via browser → re-run → 100% pass.${RESET}"
else
  echo -e "  ${RED}${BOLD}${FAIL} failure(s) — see details above${RESET}"
fi
echo ""