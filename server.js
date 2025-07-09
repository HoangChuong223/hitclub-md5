const WebSocket = require("ws");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;

// Kết quả hiện tại
let currentResult = {
  id: "binhtool90",
  time: null,
  sid: null,
  ket_qua: null,
  md5: null,
  pattern: ""
};

// Lịch sử kết quả dạng T/X
let historyResults = [];

const WS_URL = "wss://mynygwais.hytsocesk.com/websocket";
const accessToken = "1-17d1b52f17591f581fc8cd9102a28647";
const agentId = "1";

const INIT_PACKETS = [
  [1, "MiniGame", "", "", { agentId, accessToken, reconnect: false }],
  [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
  [6, "MiniGame", "taixiuKCBPlugin", { cmd: 2000 }],
  [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }],
];

function timestamp() {
  return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

function connectWebSocket() {
  const ws = new WebSocket(WS_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Origin: "https://i.hit.club",
      Host: "mynygwais.hytsocesk.com"
    }
  });

  ws.on("open", () => {
    console.log(`[✅ ${timestamp()}] Kết nối WebSocket`);
    INIT_PACKETS.forEach((packet, i) => {
      ws.send(JSON.stringify(packet));
      setTimeout(() => {
        ws.send(JSON.stringify(["7", "MiniGame", "1", i + 1]));
      }, 300);
    });

    let counter = INIT_PACKETS.length + 1;
    setInterval(() => {
      ws.send(JSON.stringify(["7", "MiniGame", "1", counter++]));
    }, 10000);
  });

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);
      if (Array.isArray(message) && message.length > 1) {
        const payload = message[1];

        // Nhận MD5 trước kết quả (phiên kế tiếp)
        if (payload?.cmd === 1015 && payload.d?.cmd === 2005) {
          const { sid, md5 } = payload.d;
          currentResult.sid = sid;
          currentResult.md5 = md5;

          // In ra MD5 khi chưa có kết quả
          console.log(`\n⏭️ Phiên kế tiếp: ${sid} | MD5: ${md5} (chưa ra kết quả)`);
        }

        // Nhận kết quả
        if (payload?.cmd === 2006) {
          const { sid, d1, d2, d3, md5 } = payload;
          if ([d1, d2, d3].every(Number.isInteger)) {
            const tong = d1 + d2 + d3;
            const result = tong >= 11 ? "Tài" : "Xỉu";

            currentResult.sid = sid;
            currentResult.ket_qua = `${d1}-${d2}-${d3} = ${tong} (${result})`;
            currentResult.md5 = md5;
            currentResult.time = timestamp();

            // Cập nhật pattern
            const patternChar = result === "Tài" ? "T" : "X";
            historyResults.push(patternChar);
            if (historyResults.length > 10) {
              historyResults.shift(); // giữ tối đa 10 kết quả
            }
            currentResult.pattern = historyResults.join("");

            // In ra console
            console.log(`[🎲 ${timestamp()}] Phiên ${sid} ➜ ${currentResult.ket_qua}`);
            console.log(`           ➜ MD5: ${md5} (by binhtool90)`);
          }
        }
      }
    } catch (err) {
      console.error(`[‼️ ${timestamp()}] Lỗi message:`, err);
    }
  });

  ws.on("close", () => {
    console.log(`[❌ ${timestamp()}] Mất kết nối. Đang reconnect...`);
    setTimeout(connectWebSocket, 5000);
  });

  ws.on("error", (err) => {
    console.error(`[‼️ ${timestamp()}] Lỗi WebSocket:`, err);
  });
}

// ✅ API JSON
app.get("/taixiu", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(currentResult, null, 2));
});

app.get("/", (req, res) => {
  res.send("🎲 Tool Tài Xỉu WebSocket - by binhtool90 đang chạy...");
});

app.listen(PORT, () => {
  console.log(`[🌐] API server chạy tại http://localhost:${PORT}`);
  connectWebSocket();
});
