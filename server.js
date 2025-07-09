const WebSocket = require("ws");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 5050;

const WS_URL = "wss://mynygwais.hytsocesk.com/websocket";
const accessToken = "1-17d1b52f17591f581fc8cd9102a28647";
const ID = "binhtool90";

// Dữ liệu lưu trữ
let lastResults = [];
let currentData = {
  id: ID,
  time: null,
  phien_truoc: {},
  phien_ke_tiep: {},
  pattern: "",
  du_doan: ""
};

// Hàm thời gian
function timestamp() {
  return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

// Dự đoán từ MD5
function predictFromMD5(md5) {
  if (!md5 || typeof md5 !== "string") return "Không rõ";
  const char = md5[0].toLowerCase();
  const num = parseInt(char, 16);
  return isNaN(num) ? "Không rõ" : (num % 2 === 0 ? "Xỉu" : "Tài");
}

// Danh sách gói khởi tạo
const INIT_PACKETS = [
  [1, "MiniGame", "", "", { agentId: "1", accessToken, reconnect: false }],
  [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
  [6, "MiniGame", "taixiuKCBPlugin", { cmd: 2000 }],
  [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
];

// Khởi tạo WebSocket
function connectWebSocket() {
  const ws = new WebSocket(WS_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Origin: "https://i.hit.club",
      Host: "mynygwais.hytsocesk.com"
    }
  });

  ws.on("open", () => {
    console.log(`[✅ ${timestamp()}] Đã kết nối WebSocket`);

    // Gửi các gói khởi tạo
    INIT_PACKETS.forEach((packet, i) => {
      ws.send(JSON.stringify(packet));
      setTimeout(() => {
        ws.send(JSON.stringify(["7", "MiniGame", "1", i + 1]));
      }, 300);
    });

    // Gửi thêm cmd:2001 sau 1s
    setTimeout(() => {
      const cmd2001 = [6, "MiniGame", "taixiuKCBPlugin", { cmd: 2001 }];
      ws.send(JSON.stringify(cmd2001));
    }, 1000);

    // Gửi keep-alive
    let counter = INIT_PACKETS.length + 1;
    setInterval(() => {
      ws.send(JSON.stringify(["7", "MiniGame", "1", counter++]));
    }, 10000);
  });

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (!Array.isArray(data) || data.length < 2) return;
      const payload = data[1];
      const d = payload.d;

      if (!d || !d.cmd) return;

      const sid = d.sid;
      const md5 = d.md5;
      const cmd = d.cmd;

      if (cmd === 2005) {
        // Phiên kế tiếp
        currentData.phien_ke_tiep = { sid, md5 };
        console.log(`\n⏭️ Phiên kế tiếp: ${sid} | MD5: ${md5} (chưa ra kết quả)`);
      }

      if (cmd === 2006 && d.d1 !== undefined) {
        const { d1, d2, d3 } = d;
        const total = d1 + d2 + d3;
        const result = total >= 11 ? "Tài" : "Xỉu";
        const patternChar = result === "Tài" ? "t" : "x";

        lastResults.push(patternChar);
        if (lastResults.length > 10) lastResults.shift();

        const pattern = lastResults.join("");
        const du_doan = predictFromMD5(md5);
        const now = timestamp();

        currentData.phien_truoc = {
          sid,
          ket_qua: `${d1}-${d2}-${d3} = ${total} (${result})`,
          md5
        };
        currentData.time = now;
        currentData.pattern = pattern;
        currentData.du_doan = du_doan;

        console.log(`\n[🎲 ${now}] Phiên ${sid}: ${d1}-${d2}-${d3} = ${total} ➜ ${result}`);
        console.log(`           ➜ MD5: ${md5} | Dự đoán: ${du_doan} | Pattern: ${pattern}`);
      }
    } catch (err) {
      console.log(`[‼️ ${timestamp()}] Lỗi xử lý tin nhắn:`, err.message);
    }
  });

  ws.on("close", () => {
    console.log(`[❌ ${timestamp()}] Mất kết nối. Reconnecting...`);
    setTimeout(connectWebSocket, 3000);
  });

  ws.on("error", (err) => {
    console.log(`[‼️ ${timestamp()}] WebSocket Error:`, err.message);
  });
}

// REST API
app.get("/data", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(currentData, null, 2));
});

app.get("/", (req, res) => {
  res.send("🎲 Tool Tài Xỉu WebSocket - by binhtool90 đang chạy...");
});

// Start server
app.listen(PORT, () => {
  console.log(`[🌐] API chạy tại http://localhost:${PORT}/data`);
  connectWebSocket();
});
