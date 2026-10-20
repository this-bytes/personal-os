#!/usr/bin/env bash
#
# Verify a running Personal OS deployment.
#
# Checks that the published port serves the client and the API, and that the
# whole stack works together: the owner account, a registered agent, a chat
# turn that the worker answers, and the audit trail.
#
#   ./scripts/verify-deployment.sh [base-url]
#
# The default base URL is http://127.0.0.1:4317.

set -euo pipefail

BASE="${1:-http://127.0.0.1:4317}"
EMAIL="deploy-check@example.com"
PASSWORD="correct horse battery"
WORK="$(mktemp -d)"
COOKIE="$WORK/cookies.txt"

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

fail() { echo "FAIL: $1" >&2; exit 1; }
ok() { echo "  ok  $1"; }

# Read one value out of a JSON file. Python is used rather than a regular
# expression because these objects contain several nested "id" fields, and a
# greedy pattern picks the wrong one.
json() {
  python3 -c '
import json, sys
with open(sys.argv[1]) as handle:
    data = json.load(handle)
for key in sys.argv[2].split("."):
    data = data[int(key)] if key.isdigit() else data[key]
print(data)
' "$1" "$2"
}

echo "== checking $BASE =="

# --- the client is served ---------------------------------------------------
INDEX_CODE="$(curl -s -o "$WORK/index.html" -w '%{http_code}' "$BASE/")"
[ "$INDEX_CODE" = "200" ] || fail "the client is not served (HTTP $INDEX_CODE)"
grep -q '<div id="root">' "$WORK/index.html" || fail "the served page is not the web client"
ok "the web client is served"

# --- the api answers --------------------------------------------------------
curl -s -o "$WORK/health.json" "$BASE/api/health"
grep -q '"ok":true' "$WORK/health.json" || fail "the health endpoint does not report ok"
ok "the health endpoint reports ok"

# --- the owner account ------------------------------------------------------
SETUP_CODE="$(curl -s -o "$WORK/setup.json" -w '%{http_code}' -c "$COOKIE" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"displayName\":\"Deploy Check\"}" \
  "$BASE/api/auth/setup")"
if [ "$SETUP_CODE" = "201" ]; then
  ok "the owner account was created"
else
  # An instance that already has an owner refuses a second setup; sign in.
  LOGIN_CODE="$(curl -s -o "$WORK/login.json" -w '%{http_code}' -c "$COOKIE" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
    "$BASE/api/auth/login")"
  [ "$LOGIN_CODE" = "200" ] \
    || fail "could not sign in (setup $SETUP_CODE, login $LOGIN_CODE): $(cat "$WORK/login.json")"
  ok "the owner signed in"
fi

# --- a workspace ------------------------------------------------------------
curl -s -o "$WORK/workspaces.json" -b "$COOKIE" "$BASE/api/workspaces"
WORKSPACE_ID="$(json "$WORK/workspaces.json" workspaces.0.id)"
ok "a workspace exists"

# --- an agent connection ----------------------------------------------------
AGENT_CODE="$(curl -s -o "$WORK/agent.json" -w '%{http_code}' -b "$COOKIE" \
  -H 'content-type: application/json' \
  -d "{\"workspaceId\":\"$WORKSPACE_ID\",\"name\":\"Deploy Echo\",\"adapterType\":\"echo\",\"config\":{\"reply\":\"the deployment works\"}}" \
  "$BASE/api/agents")"
[ "$AGENT_CODE" = "201" ] \
  || fail "the agent connection was not created (HTTP $AGENT_CODE): $(cat "$WORK/agent.json")"
ok "an agent connection was created"

# --- a conversation ---------------------------------------------------------
CONV_CODE="$(curl -s -o "$WORK/conv.json" -w '%{http_code}' -b "$COOKIE" \
  -H 'content-type: application/json' \
  -d "{\"workspaceId\":\"$WORKSPACE_ID\",\"title\":\"Deploy check\"}" \
  "$BASE/api/conversations")"
[ "$CONV_CODE" = "201" ] \
  || fail "the conversation was not created (HTTP $CONV_CODE): $(cat "$WORK/conv.json")"
CONV_ID="$(json "$WORK/conv.json" conversation.id)"
ok "a conversation was created"

# --- a turn the worker answers ----------------------------------------------
MSG_CODE="$(curl -s -o "$WORK/message.json" -w '%{http_code}' -b "$COOKIE" \
  -H 'content-type: application/json' \
  -d '{"content":[{"type":"text","text":"@Deploy Echo hello from the deployment check"}]}' \
  "$BASE/api/conversations/$CONV_ID/messages")"
[ "$MSG_CODE" = "201" ] \
  || fail "the message was not accepted (HTTP $MSG_CODE): $(cat "$WORK/message.json")"

REPLIED=false
for _ in $(seq 1 40); do
  sleep 0.5
  curl -s -o "$WORK/snapshot.json" -b "$COOKIE" "$BASE/api/conversations/$CONV_ID/messages"
  if grep -q 'the deployment works' "$WORK/snapshot.json"; then
    REPLIED=true
    break
  fi
done
[ "$REPLIED" = true ] || fail "the worker did not answer within 20 seconds"
ok "the worker answered the message"

# --- the audit trail --------------------------------------------------------
curl -s -o "$WORK/audit.json" -b "$COOKIE" "$BASE/api/audit?workspaceId=$WORKSPACE_ID"
grep -q 'agent.created' "$WORK/audit.json" || fail "the audit trail has no agent creation"
ok "the audit trail records the work"

# --- the MCP surface --------------------------------------------------------
curl -s -o "$WORK/mcp.txt" -X POST -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  "$BASE/mcp"
grep -q 'conversation.post' "$WORK/mcp.txt" || fail "MCP does not expose its tools"
ok "the MCP endpoint exposes its tools"

echo ""
echo "The deployment at $BASE is working."
