#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# curl-commands.sh
# Individual copy-paste curl commands for manual testing
# Run each one separately in your terminal
# ─────────────────────────────────────────────────────────────────────────────

# ── SET THESE TWO FIRST ───────────────────────────────────────────────────────
API="http://localhost:3000/api"
TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6IjJiMzZhYjQxYTczOTJlMTRlNjM1ZmRlM2M2YWYwOWZlYmFhM2YyZDYiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiRml4dG9uZSBEYW11Y2hpIiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL3F1b3Rlc2FwcC0yNmY4NCIsImF1ZCI6InF1b3Rlc2FwcC0yNmY4NCIsImF1dGhfdGltZSI6MTc3NzIyODAxNCwidXNlcl9pZCI6IjNrb0xLcDNmdWJicWlHaHR5MWF4NlZwNGVCVTIiLCJzdWIiOiIza29MS3AzZnViYnFpR2h0eTFheDZWcDRlQlUyIiwiaWF0IjoxNzc3MjI4MDE0LCJleHAiOjE3NzcyMzE2MTQsImVtYWlsIjoiZml4dG9uZTk0dGVjQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbImZpeHRvbmU5NHRlY0BnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.odM0ONgUeEg-C4mmAyc5XOzObYG9aLLfnu9mFfJzrACUEtblWtfludIgAx6F14Soyfznrk2eN-wR7FJ0f2Il-wT0IkD0dQZCoKNwPBllYvuws_DcZ6a55l9kKnXOFz03xaUsv0T71YgVz5n6REE08G7nBK6t4sCJ5Gv5UYdXyWvY9MrDi29Kzq4GstpsnY4db_qkL8RI_Xjpp8byR5-IdVWpnLytP46uSxcu2neBI_QL78cd6y9gdw06jmw2zQyeMvWh6XbH7zw4BBeQnwg87IGk7ct-XWLcSKc-9lg9nLpttMdhRbGrE99zuxRdr-XlIkHpRMnMHp7-vSDsW2amlA"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Get your Firebase token
# Replace YOUR_WEB_API_KEY, email, and password
# ─────────────────────────────────────────────────────────────────────────────
curl -s -X POST \
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyAzwS8amkkAside05KlJOsXJol8C79Yl1w' \
  -H 'Content-Type: application/json' \
  -d '{"email":"fixtone94tec@gmail.com","password":"YourStrongPass123","returnSecureToken":true}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['idToken'])"


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Check X connection status
# ─────────────────────────────────────────────────────────────────────────────
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  $API/x/status \
  | python3 -m json.tool


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Start OAuth (get the redirect URL — paste it in your browser)
# ─────────────────────────────────────────────────────────────────────────────
curl -v \
  -H "Authorization: Bearer $TOKEN" \
  --max-redirs 0 \
  $API/x/connect 2>&1 | grep "Location:"


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Test validation — all these should return 400
# ─────────────────────────────────────────────────────────────────────────────

# Empty body
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  $API/x/post | python3 -m json.tool

# Empty text
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"","sourceId":"abc123","sourceType":"quote"}' \
  $API/x/post | python3 -m json.tool

# Text over 280 chars (281 x's)
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"$(python3 -c "print('x'*281)")\",\"sourceId\":\"abc123\",\"sourceType\":\"quote\"}" \
  $API/x/post | python3 -m json.tool

# Missing sourceId
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","sourceType":"quote"}' \
  $API/x/post | python3 -m json.tool


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Send a real tweet (only after connecting X in Step 3)
# Replace REAL_QUOTE_ID with an actual quote ID from your Firestore
# ─────────────────────────────────────────────────────────────────────────────
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "\"The only way to do great work is to love what you do.\"\n— Steve Jobs\n#motivation #Damuchi",
    "sourceId": "REAL_QUOTE_ID",
    "sourceType": "quote"
  }' \
  $API/x/post | python3 -m json.tool


# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: View post history
# ─────────────────────────────────────────────────────────────────────────────
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "$API/x/history?limit=10" \
  | python3 -m json.tool


# ─────────────────────────────────────────────────────────────────────────────
# STEP 7: Check HTTP status codes only (no body) — quick sanity check
# ─────────────────────────────────────────────────────────────────────────────
echo "--- HTTP status codes ---"
echo -n "GET  /x/status   → "; curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" $API/x/status
echo -n "GET  /x/history  → "; curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" $API/x/history
echo -n "POST /x/post {}  → "; curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}' $API/x/post
echo -n "GET  /x/status (no auth) → "; curl -s -o /dev/null -w "%{http_code}\n" $API/x/status


# ─────────────────────────────────────────────────────────────────────────────
# STEP 8: Disconnect (run when you want to test re-auth flow)
# ─────────────────────────────────────────────────────────────────────────────
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  $API/x/disconnect \
  | python3 -m json.tool