const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HTTP_PORT = 3000;
const HTTPS_PORT = 3443;
const ROOT = __dirname;

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

function handleRequest(req, res) {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
    res.end(content);
  });
}

// ローカルIP取得
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();

// 1. HTTP サーバー
const httpServer = http.createServer(handleRequest);
httpServer.listen(HTTP_PORT, () => {
  console.log(`[HTTP]  PC用アクセス: http://localhost:${HTTP_PORT}`);
});

// 2. HTTPS サーバー (スマホのセンサーAPI・DeviceMotion許可に必須)
try {
  const options = {
    key: fs.readFileSync(path.join(ROOT, 'server.key')),
    cert: fs.readFileSync(path.join(ROOT, 'server.crt'))
  };
  const httpsServer = https.createServer(options, handleRequest);
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`[HTTPS] スマホ用アクセス (同一Wi-Fi): https://${localIp}:${HTTPS_PORT}`);
    console.log(`       ※スマホで開く際は「詳細」➔「アクセスする/信頼する」をタップしてください。`);
  });
} catch (e) {
  console.warn('HTTPS証明書が見つからないためHTTPSサーバーはスキップされました:', e.message);
}
