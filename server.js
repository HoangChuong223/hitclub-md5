const WebSocket = require("ws");
const express = require("express");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 8686;

// Configuration
const WS_URL = "wss://mynygwais.hytsocesk.com/websocket";
const ACCESS_TOKEN = "1-610307d65ec3bb965bee07ed3218e9ff";
const ID = "user_" + Math.floor(10000 + Math.random() * 90000);

// Human behavior simulation
let humanBehavior = {
  activeHours: [9, 10, 11, 14, 15, 16, 20, 21, 22], // Peak hours
  typingSpeed: [100, 300], // Typing speed (ms)
  breakTimes: [5, 15], // Break duration (minutes)
  nextBreak: 0,
  isActive: true,
  lastActionTime: Date.now(),
  activityLevel: 0.8 // 0-1 how active the user is
};

// User agents pool
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (Linux; Android 10; SM-A505FN) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
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

// Helper functions
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function timestamp() {
  return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function predictFromMD5(md5) {
  if (!md5 || typeof md5 !== "string") return "Không rõ";
  const char = md5[0].toLowerCase();
  const num = parseInt(char, 16);
  return isNaN(num) ? "Không rõ" : (num % 2 === 0 ? "Xỉu" : "Tài");
}

// Human behavior simulation
function simulateHumanActivity() {
  const now = new Date();
  const hour = now.getHours();
  
  // Check if in active hours
  humanBehavior.isActive = humanBehavior.activeHours.includes(hour) && 
                         Math.random() < humanBehavior.activityLevel;
  
  // Schedule random breaks
  if (humanBehavior.nextBreak <= Date.now()) {
    const breakDuration = randomDelay(...humanBehavior.breakTimes) * 60 * 1000;
    humanBehavior.nextBreak = Date.now() + breakDuration;
    humanBehavior.isActive = false;
    
    console.log(`[🧑 ${timestamp()}] Giả lập người dùng nghỉ ngơi trong ${breakDuration/60000} phút`);
    
    setTimeout(() => {
      humanBehavior.isActive = true;
      console.log(`[🧑 ${timestamp()}] Người dùng quay lại hoạt động`);
    }, breakDuration);
  }
}

function simulateTyping(text, callback) {
  const chars = text.split("");
  let i = 0;
  
  function typeNextChar() {
    if (i < chars.length) {
      setTimeout(() => {
        i++;
        typeNextChar();
      }, randomDelay(...humanBehavior.typingSpeed));
    } else {
      callback();
    }
  }
  
  typeNextChar();
}

// WebSocket connection with human-like behavior
function connectWebSocket() {
  if (!humanBehavior.isActive) {
    console.log(`[⏸️ ${timestamp()}] Người dùng không hoạt động`);
    return setTimeout(connectWebSocket, randomDelay(30000, 60000));
  }

  // Simulate page loading delay
  setTimeout(() => {
    console.log(`[🧑 ${timestamp()}] Người dùng đang mở trang...`);
    
    ws = new WebSocket(WS_URL, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Origin": "https://i.hit.club",
        "Host": "mynygwais.hytsocesk.com",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-WebSocket-Extensions": "permessage-deflate; client_max_window_bits"
      }
    });

    ws.on("open", () => {
      console.log(`[✅ ${timestamp()}] Kết nối thành công`);
      lastPingTime = Date.now();

      // Simulate login process
      simulateTyping('login', () => {
        setTimeout(() => {
          ws.send(JSON.stringify([
            1, "MiniGame", "", "", {
              agentId: "1",
              accessToken: ACCESS_TOKEN,
              reconnect: false
            }
          ]));
          
          // Simulate reading time before requesting game data
          setTimeout(() => {
            ws.send(JSON.stringify([
              6, "MiniGame", "taixiuKCBPlugin", { cmd: 2001 }
            ]));
          }, randomDelay(1000, 5000));
        }, randomDelay(500, 2000));
      });

      startKeepAlive();
    });

    ws.on("message", (msg) => {
      lastPingTime = Date.now();
      humanBehavior.lastActionTime = Date.now();

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

          // Simulate human reaction to results
          const reactionTime = randomDelay(500, 3000);
          setTimeout(() => {
            console.log(`[🎲 ${timestamp()}] Phiên ${sid}: ${d1}-${d2}-${d3} = ${total} ➜ ${result}`);
            console.log(`[🧑 ${timestamp()}] Phản ứng: "${du_doan === result ? 'Chuẩn!' : 'Sai rồi!'}"`);
          }, reactionTime);
        }
      } catch (err) {
        console.log("[‼️] Lỗi xử lý:", err.message);
      }
    });

    ws.on("close", () => {
      console.log(`[❌ ${timestamp()}] Ngắt kết nối`);
      setTimeout(reconnectWebSocket, randomDelay(5000, 30000));
    });

    ws.on("error", (err) => {
      console.log(`[‼️ ${timestamp()}] Lỗi WebSocket:`, err.message);
    });
  }, randomDelay(0, 10000));
}

function reconnectWebSocket() {
  try { 
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  } catch (e) {}
  
  setTimeout(connectWebSocket, randomDelay(2000, 10000));
}

function startKeepAlive() {
  const keepAliveInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        setTimeout(() => {
          ws.send(JSON.stringify(["7", "MiniGame", "1", pingCounter++]));
          
          // Randomly request game data (not too frequently)
          if (Math.random() > 0.7) {
            ws.send(JSON.stringify([
              6, "MiniGame", "taixiuKCBPlugin", { cmd: 2001 }
            ]));
          }
        }, randomDelay(0, 3000));
      } catch (e) {
        clearInterval(keepAliveInterval);
      }
    } else {
      clearInterval(keepAliveInterval);
    }
  }, 10000 + randomDelay(-2000, 2000));
}

// Check for zombie connection
setInterval(() => {
  const now = Date.now();
  const diff = now - lastPingTime;
  if (diff > 30000 + randomDelay(0, 15000)) {
    console.log(`[⛔ ${timestamp()}] Không phản hồi trong ${diff}ms. Kết nối lại...`);
    reconnectWebSocket();
  }
}, 15000 + randomDelay(0, 10000));

// Monitor human behavior
setInterval(simulateHumanActivity, 60000);

// REST API
app.get("/data", (req, res) => {
  res.json(currentData);
});

app.get("/", (req, res) => {
  res.send(`🎲 Tool Tài Xỉu WebSocket - ID: ${ID} | Token: ${ACCESS_TOKEN} | Đang chạy...`);
});

// Start server
app.listen(PORT, () => {
  console.log(`[🌐 ${timestamp()}] Server đang chạy tại http://localhost:${PORT}`);
  simulateHumanActivity();
  setTimeout(connectWebSocket, randomDelay(5000, 15000));
});
