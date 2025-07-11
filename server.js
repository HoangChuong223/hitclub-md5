const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const http = require('http');
const crypto = require('crypto');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// CẤU HÌNH CÁ NHÂN HÓA
const USER_CONFIG = {
  ACCESS_TOKEN: "1-bbaf7797f7d504f6ebd2979af2b35fac",
  USER_ID: "binhtool90",
  WS_URL: "wss://mynygwais.hytsocesk.com/websocket"
};

// Cấu hình hệ thống
const SYSTEM_CONFIG = {
  MAX_RETRIES: 15,
  BASE_RETRY_DELAY: 1500,
  MAX_RETRY_DELAY: 60000,
  CONNECTION_TIMEOUT: 10000,
  INACTIVITY_TIMEOUT: 45000,
  PING_INTERVAL: 12000,
  USER_AGENTS: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; SM-S901U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.143 Mobile Safari/537.36'
  ]
};

// Trạng thái hệ thống
const state = {
  ws: null,
  pingInterval: null,
  retryTimeout: null,
  connectionTimeout: null,
  retryCount: 0,
  isConnected: false,
  isConnecting: false,
  lastActivity: 0,
  lastPing: 0,
  sessionId: null,
  gameData: {
    patternHistory: [],
    currentResult: null,
    prediction: null,
    userInfo: {
      id: USER_CONFIG.USER_ID,
      lastUpdate: null
    }
  }
};

// Utility functions
function getTime() {
  return new Date().toLocaleTimeString('vi-VN');
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(array) {
  return array[randomInt(0, array.length - 1)];
}

function calculateRetryDelay(attempt) {
  const delay = Math.min(
    SYSTEM_CONFIG.MAX_RETRY_DELAY,
    SYSTEM_CONFIG.BASE_RETRY_DELAY * Math.pow(1.8, attempt)
  );
  return delay + randomInt(0, 2000);
}

// Quản lý kết nối WebSocket
function connect() {
  if (state.isConnected || state.isConnecting) return;
  if (state.retryCount >= SYSTEM_CONFIG.MAX_RETRIES) {
    console.log(`[${getTime()}] ⛔ Đã đạt giới hạn kết nối lại (${SYSTEM_CONFIG.MAX_RETRIES} lần)`);
    return;
  }

  cleanup();
  state.isConnecting = true;
  state.retryCount++;

  console.log(`[${getTime()}] 🔄 Đang kết nối (lần thử ${state.retryCount})...`);

  // Tạo kết nối mới
  state.ws = new WebSocket(USER_CONFIG.WS_URL, {
    headers: {
      "User-Agent": randomItem(SYSTEM_CONFIG.USER_AGENTS),
      "Origin": "https://i.hit.club",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "X-Client-ID": crypto.randomBytes(8).toString('hex'),
      "X-Forwarded-For": `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`
    }
  });

  // Thiết lập timeout kết nối
  state.connectionTimeout = setTimeout(() => {
    if (!state.isConnected) {
      console.log(`[${getTime()}] ⏱️ Timeout kết nối sau ${SYSTEM_CONFIG.CONNECTION_TIMEOUT/1000}s`);
      state.ws.close();
    }
  }, SYSTEM_CONFIG.CONNECTION_TIMEOUT);

  // Xử lý sự kiện WebSocket
  setupEventHandlers();
}

function cleanup() {
  clearTimeout(state.retryTimeout);
  clearTimeout(state.connectionTimeout);
  clearInterval(state.pingInterval);
  
  if (state.ws) {
    state.ws.removeAllListeners();
    if (state.ws.readyState === WebSocket.OPEN) {
      state.ws.close();
    }
    state.ws = null;
  }
}

function setupEventHandlers() {
  state.ws.on('open', () => {
    clearTimeout(state.connectionTimeout);
    state.isConnected = true;
    state.isConnecting = false;
    state.retryCount = 0;
    state.lastActivity = Date.now();
    console.log(`[${getTime()}] ✅ Kết nối thành công với ID: ${USER_CONFIG.USER_ID}`);

    initializeConnection();
    startKeepAlive();
    simulateUserBehavior();
  });

  state.ws.on('message', (data) => {
    state.lastActivity = Date.now();
    try {
      processMessage(data);
    } catch (err) {
      console.log(`[${getTime()}] ❌ Lỗi xử lý message: ${err.message}`);
    }
  });

  state.ws.on('close', () => {
    handleDisconnect();
  });

  state.ws.on('error', (err) => {
    console.log(`[${getTime()}] ❌ Lỗi kết nối: ${err.message}`);
    handleDisconnect();
  });
}

function initializeConnection() {
  const messages = [
    [1, "MiniGame", "", "", {
      agentId: "1",
      accessToken: USER_CONFIG.ACCESS_TOKEN,
      reconnect: false
    }],
    [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }],
    [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
    [6, "MiniGame", "taixiuKCBPlugin", { cmd: 2001 }]
  ];

  messages.forEach((msg, i) => {
    setTimeout(() => {
      try {
        sendMessage(msg, `Khởi tạo ${msg[3]?.cmd || msg[0]}`);
      } catch (err) {
        console.log(`[${getTime()}] ❌ Lỗi gửi message khởi tạo: ${err.message}`);
      }
    }, randomInt(300, 1200) * (i + 1));
  });
}

function sendMessage(message, description = '') {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    console.log(`[${getTime()}] ⚠️ Không thể gửi - Kết nối đã đóng`);
    return false;
  }

  try {
    state.ws.send(JSON.stringify(message));
    state.lastActivity = Date.now();
    if (description) {
      console.log(`[${getTime()}] 📤 ${description}`);
    }
    return true;
  } catch (err) {
    console.log(`[${getTime()}] ❌ Lỗi gửi message: ${err.message}`);
    return false;
  }
}

function handleDisconnect() {
  state.isConnected = false;
  state.isConnecting = false;
  console.log(`[${getTime()}] ⚠️ Mất kết nối`);

  cleanup();

  if (state.retryCount < SYSTEM_CONFIG.MAX_RETRIES) {
    const delay = calculateRetryDelay(state.retryCount);
    console.log(`[${getTime()}] ⏳ Sẽ thử lại sau ${(delay/1000).toFixed(2)}s...`);
    
    state.retryTimeout = setTimeout(() => {
      connect();
    }, delay);
  }
}

function startKeepAlive() {
  state.pingInterval = setInterval(() => {
    if (!state.isConnected) {
      clearInterval(state.pingInterval);
      return;
    }

    if (Date.now() - state.lastActivity > SYSTEM_CONFIG.INACTIVITY_TIMEOUT) {
      console.log(`[${getTime()}] 🚨 Không có hoạt động trong ${SYSTEM_CONFIG.INACTIVITY_TIMEOUT/1000}s`);
      state.ws.close();
      return;
    }

    if (sendMessage(["7", "MiniGame", "1", Date.now()], "Ping")) {
      state.lastPing = Date.now();
      
      if (Math.random() > 0.6) {
        sendMessage([6, "MiniGame", "taixiuKCBPlugin", { cmd: 2001 }], "Request dữ liệu");
      }
    }
  }, SYSTEM_CONFIG.PING_INTERVAL);
}

function simulateUserBehavior() {
  const actions = [
    () => sendMessage([6, "MiniGame", "taixiuPlugin", { cmd: 1002 }], "Xem lịch sử"),
    () => sendMessage([6, "MiniGame", "lobbyPlugin", { cmd: 10001 }], "Xem thông tin phòng"),
    () => sendMessage([6, "MiniGame", "taixiuKCBPlugin", { cmd: 2002 }], "Xem thông tin khác")
  ];

  const performAction = () => {
    if (!state.isConnected) return;

    if (Math.random() < 0.3) {
      try {
        const action = randomItem(actions);
        action();
      } catch (err) {
        console.log(`[${getTime()}] ❌ Lỗi hành vi người dùng: ${err.message}`);
      }
    }

    setTimeout(performAction, randomInt(20000, 90000));
  };

  setTimeout(performAction, randomInt(10000, 30000));
}

function processMessage(data) {
  const msg = JSON.parse(data);
  if (!Array.isArray(msg) || typeof msg[1] !== 'object') return;

  const { cmd, sid, gBB, d1, d2, d3 } = msg[1];

  if ((cmd === 1002 || cmd === 1008) && sid && sid !== state.sessionId) {
    state.sessionId = sid;
    console.log(`[${getTime()}] 🔄 Session mới: ${sid}`);
  }

  if ((cmd === 1003 || cmd === 1004) && d1 !== undefined && d2 !== undefined && d3 !== undefined) {
    const total = d1 + d2 + d3;
    const result = total > 10 ? 'Tài' : 'Xỉu';

    state.gameData.patternHistory.push(result[0]);
    if (state.gameData.patternHistory.length > 15) {
      state.gameData.patternHistory.shift();
    }

    const pattern = state.gameData.patternHistory.join('');
    state.gameData.prediction = enhancedPrediction(pattern);
    
    state.gameData.currentResult = {
      time: getTime(),
      userId: USER_CONFIG.USER_ID,
      sessionId: state.sessionId,
      result: `${d1}-${d2}-${d3} = ${total} (${result})`,
      pattern: pattern,
      prediction: state.gameData.prediction
    };

    state.gameData.userInfo.lastUpdate = new Date().toISOString();

    console.log(`[${getTime()}] 🎲 ${state.gameData.currentResult.result}`);
    console.log(`           🔮 Dự đoán: ${state.gameData.prediction}`);
    console.log(`           👤 User ID: ${USER_CONFIG.USER_ID}`);
  }
}

function enhancedPrediction(pattern) {
  if (pattern.length < 8) return "Đang phân tích...";
  
  const lastSegment = pattern.slice(-5);
  const taiCount = lastSegment.filter(x => x === 'T').length;
  const xiuCount = lastSegment.filter(x => x === 'X').length;

  if (taiCount >= 4) return "Xỉu (xu hướng đảo chiều)";
  if (xiuCount >= 4) return "Tài (xu hướng đảo chiều)";
  
  if (pattern.endsWith('TTT')) return "Xỉu";
  if (pattern.endsWith('XXX')) return "Tài";
  
  return taiCount > xiuCount ? "Tài" : xiuCount > taiCount ? "Xỉu" : "Ngẫu nhiên";
}

// API endpoints
app.get('/api/data', (req, res) => {
  res.json({
    status: state.isConnected ? 'connected' : 'disconnected',
    retryCount: state.retryCount,
    lastActivity: new Date(state.lastActivity).toISOString(),
    userInfo: state.gameData.userInfo,
    gameData: state.gameData.currentResult
  });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>WebSocket Client - ${USER_CONFIG.USER_ID}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .status { padding: 10px; border-radius: 5px; margin-bottom: 20px; }
          .connected { background: #d4edda; color: #155724; }
          .disconnected { background: #f8d7da; color: #721c24; }
          pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
          .user-info { background: #e2e3e5; padding: 10px; border-radius: 5px; margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>WebSocket Client - ${USER_CONFIG.USER_ID}</h1>
          <div class="user-info">
            <strong>User ID:</strong> ${USER_CONFIG.USER_ID}<br>
            <strong>Trạng thái:</strong> <span id="status">${state.isConnected ? '🟢 Đang kết nối' : '🔴 Mất kết nối'}</span>
          </div>
          <div id="data">
            <pre>${JSON.stringify(state.gameData.currentResult || 'Đang chờ dữ liệu...', null, 2)}</pre>
          </div>
        </div>
        <script>
          function updateData() {
            fetch('/api/data')
              .then(res => res.json())
              .then(data => {
                document.getElementById('status').textContent = 
                  data.status === 'connected' ? '🟢 Đang kết nối' : '🔴 Mất kết nối';
                
                if (data.gameData) {
                  document.querySelector('pre').textContent = JSON.stringify(data.gameData, null, 2);
                }
              })
              .catch(err => {
                console.error('Lỗi cập nhật:', err);
              });
          }
          
          setInterval(updateData, 3000);
          updateData();
        </script>
      </body>
    </html>
  `);
});

// Khởi động hệ thống
app.listen(PORT, () => {
  console.log(`[${getTime()}] 🚀 Hệ thống đã sẵn sàng tại http://localhost:${PORT}`);
  console.log(`[${getTime()}] 👤 User ID: ${USER_CONFIG.USER_ID}`);
  connect();
});

// Giữ server hoạt động
setInterval(() => {
  http.get(`http://localhost:${PORT}/api/data`);
}, 300000);
