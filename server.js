const WebSocket = require("ws");
const express = require("express");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 5050;

// Cấu hình với các giá trị ngẫu nhiên
const WS_URL = "wss://mynygwais.hytsocesk.com/websocket";
const accessToken = "1-bbaf7797f7d504f6ebd2979af2b35fac";
const ID = "binhtool90";
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

// Danh sách User-Agent ngẫu nhiên
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function timestamp() {
  return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

function predictFromMD5(md5) {
  if (!md5 || typeof md5 !== "string") return "Không rõ";
  const char = md5[0].toLowerCase();
  const num = parseInt(char, 16);
  return isNaN(num) ? "Không rõ" : (num % 2 === 0 ? "Xỉu" : "Tài");
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function connectWebSocket() {
  ws = new WebSocket(WS_URL, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      "Origin": "https://i.hit.club",
      "Host": "mynygwais.hytsocesk.com",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    }
  });

  ws.on("open", () => {
    console.log(`[✅ ${timestamp()}] Đã kết nối WebSocket thành công`);
    lastPingTime = Date.now();

    // Thêm độ trễ ngẫu nhiên trước khi gửi tin nhắn đầu tiên
    setTimeout(() => {
      ws.send(JSON.stringify([
        1, "MiniGame", "", "", {
          agentId: "1",
          accessToken,
          reconnect: false
        }
      ]));
    }, randomDelay(500, 2000));

    // Thêm độ trễ ngẫu nhiên cho lệnh 2001
    setTimeout(() => {
      ws.send(JSON.stringify([
        6, "MiniGame", "taixiuKCBPlugin", { cmd: 2001 }
      ]));
    }, randomDelay(1000, 3000));

    autoKeepAlive();
  });

  ws.on("message", (msg) => {
    lastPingTime = Date.now();

    try {
      const data = JSON.parse(msg);
      if (!Array.isArray(data) || data[0] !== 5 || typeof data[1] !== "object") return;
      const d = data[1].d;
      if (!d || typeof d.cmd !== "number") return;

      const { cmd, sid, md5 } = d;

      if (cmd === 2005) {
        currentData.phien_ke_tiep = { sid, md5 };
        console.log(`[⏭️ ${timestamp()}] Phiên kế tiếp: ${sid} | MD5: ${md5}`);
      }

      if (cmd === 2006 && d.d1 !== undefined) {
        const { d1, d2, d3 } = d;
        const total = d1 + d2 + d3;
        const result = total >= 11 ? "Tài" : "Xỉu";

        lastResults.push(result === "Tài" ? "t" : "x");
        if (lastResults.length > 10) lastResults.shift();

        const pattern = lastResults.join("");
        const du_doan = predictFromMD5(md5);

        currentData.phien_truoc = {
          sid,
          ket_qua: `${d1}-${d2}-${d3} = ${total} (${result})`,
          md5
        };
        currentData.pattern = pattern;
        currentData.du_doan = du_doan;
        currentData.time = timestamp();

        console.log(`[🎲 ${timestamp()}] Phiên ${sid}: ${d1}-${d2}-${d3} = ${total} ➜ ${result}`);
        console.log(`           ➜ MD5: ${md5} | Dự đoán: ${du_doan} | Pattern: ${pattern}`);
      }
    } catch (err) {
      console.log("[‼️] Lỗi xử lý:", err.message);
    }
  });

  ws.on("close", () => {
    console.log(`[❌ ${timestamp()}] Mất kết nối WebSocket. Đang kết nối lại...`);
    reconnectWebSocket();
  });

  ws.on("error", (err) => {
    console.log(`[‼️] Lỗi WebSocket:`, err.message);
  });
}

function reconnectWebSocket() {
  try { 
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  } catch (e) {}
  
  // Thêm độ trễ ngẫu nhiên trước khi kết nối lại
  setTimeout(connectWebSocket, randomDelay(2000, 10000));
}

function autoKeepAlive() {
  const keepAliveInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        // Thêm độ trễ ngẫu nhiên giữa các lần ping
        setTimeout(() => {
          ws.send(JSON.stringify(["7", "MiniGame", "1", pingCounter++]));
        ws.send(JSON.stringify([
          6, "MiniGame", "taixiuKCBPlugin", { cmd: 2001 }
        ]));
      }, randomDelay(0, 3000));
    } else {
      clearInterval(keepAliveInterval);
    }
  }, 10000 + randomDelay(-2000, 2000)); // Thêm biến động vào khoảng thời gian
}

// Kiểm tra kết nối chết với thời gian ngẫu nhiên
setInterval(() => {
  const now = Date.now();
  const diff = now - lastPingTime;
  if (diff > 30000 + randomDelay(0, 15000)) {
    console.log(`[⛔] Không phản hồi trong ${diff}ms. Đang kết nối lại...`);
    reconnectWebSocket();
  }
}, 15000 + randomDelay(0, 10000));

// REST API
app.get("/data", (req, res) => {
  res.json(currentData);
});

app.get("/", (req, res) => {
  res.send(`🎲 Tool Tài Xỉu WebSocket - ID: ${ID} đang chạy...`);
});

app.listen(PORT, () => {
  console.log(`[🌐] Server đang chạy tại http://localhost:${PORT}`);
  // Thêm độ trễ ngẫu nhiên trước khi bắt đầu kết nối
  setTimeout(connectWebSocket, randomDelay(0, 5000));
});
