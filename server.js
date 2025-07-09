const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');
const path = require('path');

const WS_URL = 'wss://mynygwais.hytsocesk.com/websocket';
const accessToken = '1-17d1b52f17591f581fc8cd9102a28647';
const agentId = '1';

const INIT_PACKETS = [
  [1, 'MiniGame', '', '', { agentId, accessToken, reconnect: false }],
  [6, 'MiniGame', 'taixiuPlugin', { cmd: 1005 }],
  [6, 'MiniGame', 'taixiuKCBPlugin', { cmd: 2000 }],
  [6, 'MiniGame', 'lobbyPlugin', { cmd: 10001 }]
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Origin: 'https://i.hit.club',
  Host: 'mynygwais.hytsocesk.com'
};

let lastResult = null;
let nextSession = null;

function logTime() {
  return new Date().toLocaleTimeString('vi-VN', { hour12: false });
}

function saveDataToFile() {
  const data = {
    id: 'binhtool90',
    phien_truoc: lastResult,
    phien_ke_tiep: nextSession
  };
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
  console.log(`💾 [${logTime()}] Đã ghi data.json`);
}

function connectWS() {
  const ws = new WebSocket(WS_URL, { headers: HEADERS });

  ws.on('open', () => {
    console.log(`[✅ ${logTime()}] Kết nối WS thành công`);
    INIT_PACKETS.forEach((packet, i) => {
      ws.send(JSON.stringify(packet));
      setTimeout(() => {
        ws.send(JSON.stringify(['7', 'MiniGame', '1', i + 1]));
      }, 400 * (i + 1));
    });

    let counter = INIT_PACKETS.length + 1;
    setInterval(() => {
      ws.send(JSON.stringify(['7', 'MiniGame', '1', counter++]));
    }, 10000);
  });

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (Array.isArray(data) && data.length > 1) {
        const payload = data[1];

        // MD5 phiên kế tiếp
        if (payload?.cmd === 1015 && payload?.d?.cmd === 2005) {
          const { sid, md5 } = payload.d;
          nextSession = { sid, md5 };
          console.log(`[🧩 ${logTime()}] Phiên kế tiếp: ${sid} ➜ MD5: ${md5}`);
          saveDataToFile();
        }

        // Kết quả phiên trước
        if (payload?.cmd === 2006) {
          const { sid, d1, d2, d3, md5 } = payload;
          if ([sid, d1, d2, d3].every(n => n !== undefined)) {
            const tong = d1 + d2 + d3;
            const ket_qua = tong >= 11 ? 'Tài' : 'Xỉu';
            lastResult = {
              sid,
              ket_qua: `${d1}-${d2}-${d3} = ${tong} (${ket_qua})`,
              md5
            };
            console.log(`[🎲 ${logTime()}] Phiên trước: ${sid} ➜ ${d1}-${d2}-${d3} = ${tong} (${ket_qua})`);
            console.log(`           ➜ MD5: ${md5}`);
            saveDataToFile();
          }
        }
      }
    } catch (e) {
      console.log(`[‼️ ${logTime()}] Lỗi xử lý tin:`, e.message);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[❌ ${logTime()}] Mất kết nối: ${code} | ${reason}`);
    setTimeout(connectWS, 5000);
  });

  ws.on('error', (err) => {
    console.log(`[‼️ ${logTime()}] WS lỗi:`, err.message);
  });
}

// HTTP server cho /taixiu
http.createServer((req, res) => {
  if (req.url === '/taixiu') {
    fs.readFile(path.join(__dirname, 'data.json'), (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Không thể đọc data.json' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('404 Not Found');
  }
}).listen(process.env.PORT || 8080, () => {
  console.log(`[🌐] Server đang chạy tại http://localhost:${process.env.PORT || 8080}/taixiu`);
});

connectWS();
