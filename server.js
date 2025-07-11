const WebSocket = require("ws");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 5050;

const WS_URL = "wss://mynygwais.hytsocesk.com/websocket";
const accessToken = "1-bbaf7797f7d504f6ebd2979af2b35fac";
const ID = "binhtool90";

// Cấu hình giả lập người dùng
const userAgents = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 12; SM-S906N Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/80.0.3987.119 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36"
];

const cookies = [
  "session_id=abc123; path=/; domain=.hytsocesk.com",
  "user_pref=dark_theme; path=/; domain=.hytsocesk.com"
];

let ws;
let lastPingTime = Date.now();
let pingCounter = 1;
let lastResults = [];
let currentData = {
  id: ID,
  time: null,
  phien_truoc: {},
  phien_ke_tiep: {},
  pattern: "",
  du_doan: ""
};

// Hàm tiện ích
function timestamp() {
  return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function predictFromMD5(md5) {
  if (!md5 || typeof md5 !== "string") return "Không rõ";
  const char = md5[0].toLowerCase();
  const num = parseInt(char, 16);
  return isNaN(num) ? "Không rõ" : (num % 2 === 0 ? "Xỉu" : "Tài");
}

// Hành vi giả lập người dùng
function simulateHumanActivity() {
  const actions = [
    () => {
      console.log(`[👤 ${timestamp()}] Giả lập: Lấy lịch sử phiên`);
      ws.send(JSON.stringify([6, "MiniGame", "taixiuKCBPlugin", { cmd: 2002 }]));
    },
    () => {
      console.log(`[👤 ${timestamp()}] Giả lập: Lấy thông tin người chơi`);
      ws.send(JSON.stringify([6, "MiniGame", "taixiuKCBPlugin", { cmd: 2003 }]));
    },
    () => {
      console.log(`[👤 ${timestamp()}] Giả lập: Lấy thông tin phòng chơi`);
      ws.send(JSON.stringify([6, "MiniGame", "taixiuKCBPlugin", { cmd: 2004 }]));
    }
  ];
  
  setTimeout(() => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        const action = actions[Math.floor(Math.random() * actions.length)];
        action();
      }
    } catch (e) {
      console.log(`[👤 ${timestamp()}] Lỗi giả lập hành vi:`, e.message);
    }
    simulateHumanActivity();
  }, randomDelay(45000, 180000)); // 45s đến 3 phút
}

// Kết nối WebSocket
function connectWebSocket() {
  const currentUA = getRandomUserAgent();
  
  console.log(`[🔗 ${timestamp()}] Đang kết nối với User-Agent: ${currentUA.split(' ')[0]}...`);
  
  ws = new WebSocket(WS_URL, {
    headers: {
      "User-Agent": currentUA,
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Origin": "https://i.hit.club",
      "Host": "mynygwais.hytsocesk.com",
      "Cookie": cookies.join("; "),
      "X-Requested-With": "XMLHttpRequest",
      "Referer": "https://i.hit.club/"
    }
  });

  ws.on("open", () => {
    console.log(`[✅ ${timestamp()}] WebSocket đã kết nối`);
    lastPingTime = Date.now();

    // Gửi thông tin đăng nhập với delay ngẫu nhiên
    setTimeout(() => {
      ws.send(JSON.stringify([
        1, "MiniGame", "", "", {
          agentId: "1",
          accessToken,
          reconnect: false
        }
      ]));
    }, randomDelay(500, 2000));

    // Gửi cmd 2001 với delay ngẫu nhiên
    setTimeout(() => {
      ws.send(JSON.stringify([
        6, "MiniGame", "taixiuKCBPlugin", { cmd: 2001 }
      ]));
    }, randomDelay(1000, 3000));

    autoKeepAlive();
    simulateHumanActivity();
  });

  ws.on("message", (msg) => {
    lastPingTime = Date.now();

    try {
      const data = JSON.parse(msg);
      if (!Array.isArray(data) || data[0] !== 5 || typeof data[1] !== "object") return;
      
      const d = data[1].d;
      if (!d || typeof d.cmd !== "number") return;

      const { cmd, sid, md5 } = d;

      // Xử lý các loại command khác nhau
      switch(cmd) {
        case 2005: // Thông tin phiên tiếp theo
          currentData.phien_ke_tiep = { sid, md5 };
          console.log(`[⏭️ ${timestamp()}] Phiên kế tiếp: ${sid} | MD5: ${md5}`);
          break;
          
        case 2006: // Kết quả phiên
          if (d.d1 !== undefined) {
            const { d1, d2, d3 } = d;
            const total = d1 + d2 + d3;
            const result = total >= 11 ? "Tài" : "Xỉu";

            lastResults.push(result === "Tài" ? "t" : "x");
            if (lastResults.length > 10) lastResults.shift();

            const pattern = lastResults.join("");
            const du_doan = predictFromMD5(currentData.phien_ke_tiep.md5);

            currentData.phien_truoc = {
              sid,
              ket_qua: `${d1}-${d2}-${d3} = ${total} (${result})`,
              md5: currentData.phien_ke_tiep.md5
            };
            currentData.pattern = pattern;
            currentData.du_doan = du_doan;
            currentData.time = timestamp();

            console.log(`[🎲 ${timestamp()}] Phiên ${sid}: ${d1}-${d2}-${d3} = ${total} ➜ ${result}`);
            console.log(`           ➜ MD5: ${currentData.phien_ke_tiep.md5} | Dự đoán: ${du_doan} | Pattern: ${pattern}`);
          }
          break;
          
        default:
          // Ghi log các command không xác định
          console.log(`[📨 ${timestamp()}] Nhận command ${cmd}:`, JSON.stringify(d).slice(0, 100));
      }
    } catch (err) {
      console.log(`[‼️ ${timestamp()}] Lỗi xử lý message:`, err.message);
    }
  });

  ws.on("close", () => {
    const retryDelay = randomDelay(3000, 10000);
    console.log(`[❌ ${timestamp()}] Mất kết nối. Sẽ reconnect sau ${retryDelay/1000}s...`);
    setTimeout(connectWebSocket, retryDelay);
  });

  ws.on("error", (err) => {
    console.log(`[‼️ ${timestamp()}] WebSocket lỗi:`, err.message);
  });
}

// Hàm giữ kết nối
function autoKeepAlive() {
  const sendPing = () => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(["7", "MiniGame", "1", pingCounter++]));
        ws.send(JSON.stringify([
          6, "MiniGame", "taixiuKCBPlugin", { cmd: 2001 }
        ]));
      }
    } catch (e) {
      console.log(`[‼️ ${timestamp()}] Lỗi ping:`, e.message);
    }
    
    // Lên lịch ping tiếp theo với delay ngẫu nhiên
    setTimeout(sendPing, randomDelay(8000, 15000));
  };
  
  // Bắt đầu chu kỳ ping
  setTimeout(sendPing, randomDelay(8000, 15000));
}

// Kiểm tra kết nối zombie
setInterval(() => {
  const now = Date.now();
  const diff = now - lastPingTime;
  if (diff > 30000) {
    console.log(`[⛔ ${timestamp()}] Không phản hồi trong ${diff}ms. Reconnect...`);
    try { ws.terminate(); } catch (e) {}
    setTimeout(connectWebSocket, randomDelay(1000, 3000));
  }
}, 15000);

// REST API
app.get("/data", (req, res) => {
  res.json(currentData);
});

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>🎲 Tool Tài Xỉu - binhtool90</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
          .container { background: #f5f5f5; padding: 20px; border-radius: 8px; }
          .data-section { margin-top: 20px; background: white; padding: 15px; border-radius: 5px; }
          pre { background: #f0f0f0; padding: 10px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎲 Tool Tài Xỉu WebSocket</h1>
          <p>by binhtool90 - Đang chạy...</p>
          <div class="data-section">
            <h3>Dữ liệu hiện tại:</h3>
            <pre>${JSON.stringify(currentData, null, 2)}</pre>
          </div>
          <p><a href="/data">Xem dữ liệu JSON</a></p>
        </div>
      </body>
    </html>
  `);
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`[🌐 ${timestamp()}] Server đang chạy tại http://localhost:${PORT}`);
  connectWebSocket();
});
