const WebSocket = require("ws");
const express = require("express");
const app = express();
const PORT = 3000;

const WS_URL = "wss://mynygwais.hytsocesk.com/websocket";
const accessToken = "1-17d1b52f17591f581fc8cd9102a28647";
const ID = "binhtool90";

let lastResults = [];
let currentData = {
  id: ID,
  phien_truoc: {},
  phien_ke_tiep: {},
  pattern: "",
  du_doan: ""
};

// WebSocket
const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("[+] WebSocket đã kết nối");

  const authPayload = [
    1,
    "MiniGame",
    "",
    "",
    {
      agentId: "1",
      accessToken,
      reconnect: false
    }
  ];
  ws.send(JSON.stringify(authPayload));

  setTimeout(() => {
    const cmdPayload = [
      6,
      "MiniGame",
      "taixiuKCBPlugin",
      { cmd: 2001 }
    ];
    ws.send(JSON.stringify(cmdPayload));
  }, 1000);
});

ws.on("message", (msg) => {
  try {
    const data = JSON.parse(msg);
    if (Array.isArray(data) && data[0] === 5 && typeof data[1] === "object") {
      const d = data[1].d;
      if (!d || !d.cmd) return;

      const sid = d.sid;
      const md5 = d.md5;
      const cmd = d.cmd;

      if (cmd === 2006 && d.d1 !== undefined) {
        const { d1, d2, d3 } = d;
        const total = d1 + d2 + d3;
        const result = total >= 11 ? "Tài" : "Xỉu";

        lastResults.push(result === "Tài" ? "t" : "x");
        if (lastResults.length > 10) lastResults.shift();

        const pattern = lastResults.join("");
        const du_doan = predictFromMD5(md5);

        currentData.phien_truoc = {
          sid, ket_qua: `${d1}-${d2}-${d3} = ${total} (${result})`,
          md5
        };
        currentData.pattern = pattern;
        currentData.du_doan = du_doan;
      }

      if (cmd === 2005) {
        currentData.phien_ke_tiep = { sid, md5 };
      }
    }
  } catch (err) {
    console.log("[!] Lỗi:", err.message);
  }
});

function predictFromMD5(md5) {
  if (!md5 || typeof md5 !== "string") return "Không rõ";
  const char = md5[0].toLowerCase();
  const num = parseInt(char, 16);
  return isNaN(num) ? "Không rõ" : (num % 2 === 0 ? "Xỉu" : "Tài");
}

// API REST
app.get("/data", (req, res) => {
  res.json(currentData);
});

app.listen(PORT, () => {
  console.log(`[🌐] Server đang chạy tại http://localhost:${PORT}`);
});
