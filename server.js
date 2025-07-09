const WebSocket = require('ws');    
const express = require('express');    
    
const WS_URL = "wss://mynygwais.hytsocesk.com/websocket";    
const ID = "binhtool90";    
const app = express();    
const PORT = process.env.PORT || 8080;
    
let phienTruoc = null;    
let phienTiep = null;    
    
// Kết nối WebSocket    
const ws = new WebSocket(WS_URL);    
    
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
            if (!d || typeof d !== 'object') return;    
    
            const cmd = d.cmd;    
            const sid = d.sid;    
            const md5 = d.md5;    
    
            if (cmd === 2006 && d.d1 !== undefined && d.d2 !== undefined && d.d3 !== undefined) {    
                const d1 = d.d1, d2 = d.d2, d3 = d.d3;    
                const total = d1 + d2 + d3;    
                const result = total >= 11 ? "Tài" : "Xỉu";    
    
                phienTruoc = {    
                    sid: sid,    
                    ket_qua: `${d1}-${d2}-${d3} = ${total} (${result})`,    
                    md5: md5    
                };    
    
                console.log("[✅] Cập nhật phiên trước:", phienTruoc);    
            }    
    
            if (cmd === 2005) {    
                phienTiep = {    
                    sid: sid,    
                    md5: md5,    
                    thong_bao: "Chưa có kết quả"    
                };    
                console.log("[⏭️] Cập nhật phiên kế tiếp:", phienTiep);    
            }    
        }    
    } catch (e) {    
        console.error('[!] Lỗi xử lý message:', e.message);    
    }    
});    
    
ws.on('error', (err) => {    
    console.error('[!] WebSocket lỗi:', err.message);    
});    
    
ws.on('close', () => {    
    console.log('[x] WebSocket đã đóng');    
});    
    
// Web API: http://localhost:8080    
app.get('/', (req, res) => {    
    res.json({    
        id: ID,    
        phien_truoc: phienTruoc,    
        phien_ke_tiep: phienTiep    
    });    
});    
    
// Start web server    
app.listen(PORT, () => {    
    console.log(`[🌐] Đang chạy tại http://localhost:${PORT}`);    
});
