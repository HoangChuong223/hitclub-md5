const WebSocket = require('ws');
const express = require('express');

const WS_URL = 'wss://mynygwais.hytsocesk.com/websocket';
const ID = 'binhtool90';
const PORT = process.env.PORT || 8080;

const app = express();
let phienTruoc = null;
let phienTiep = null;
let history = [];

let ws;

function connectWebSocket() {
    ws = new WebSocket(WS_URL, {
        headers: {
            origin: 'https://i.hit.club/?a=hitclub',
            'user-agent': 'okhttp/4.9.0'
        }
    });

    ws.on('open', () => {
        console.log('[+] Đã kết nối WebSocket');

        const authPayload = [
            1,
            "MiniGame",
            "",
            "",
            {
                agentId: "1",
                accessToken: "1-24a346d09712f8df079e14a2ed487ce4",
                reconnect: false
            }
        ];
        ws.send(JSON.stringify(authPayload));
        console.log('[>] Đã gửi xác thực');

        setTimeout(() => {
            const cmd2001 = [
                6,
                "MiniGame",
                "taixiuKCBPlugin",
                { cmd: 2001 }
            ];
            ws.send(JSON.stringify(cmd2001));
            console.log('[>] Đã gửi cmd 2001');
        }, 1000);
    });

    ws.on('message', (data) => {
        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed[0] === 5 && typeof parsed[1] === 'object') {
                const d = parsed[1].d;
                if (!d) return;

                const cmd = d.cmd;
                const sid = d.sid;
                const md5 = d.md5;

                if (cmd === 2006 && d.d1 !== undefined && d.d2 !== undefined && d.d3 !== undefined) {
                    const total = d.d1 + d.d2 + d.d3;
                    const result = total >= 11 ? 'Tài' : 'Xỉu';

                    phienTruoc = {
                        sid,
                        ket_qua: `${d.d1}-${d.d2}-${d.d3} = ${total} (${result})`,
                        md5
                    };

                    history.push(result === 'Tài' ? 'T' : 'X');
                    if (history.length > 10) history.shift();

                    console.log('[✅] Phiên trước:', phienTruoc);
                }

                if (cmd === 2005) {
                    phienTiep = {
                        sid,
                        md5,
                        thong_bao: "Chưa có kết quả"
                    };
                    console.log('[⏭️] Phiên kế tiếp:', phienTiep);
                }
            }
        } catch (e) {
            console.log('[!] Lỗi:', e.message);
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`[x] WebSocket đóng | Code: ${code} | Reason: ${reason}`);
        reconnect();
    });

    ws.on('error', (err) => {
        console.log('[!] WebSocket lỗi:', err.message);
        reconnect();
    });
}

function reconnect() {
    console.log('[🔁] Kết nối lại sau 5s...');
    setTimeout(connectWebSocket, 5000);
}

connectWebSocket();

app.get('/', (req, res) => {
    res.json({
        id: ID,
        phien_truoc: phienTruoc,
        phien_ke_tiep: {
            ...phienTiep,
            Pattern: history.join('').toLowerCase() // T -> t, X -> x
        }
    });
});

app.listen(PORT, () => {
    console.log(`[🌐] API chạy tại http://localhost:${PORT}`);
});
