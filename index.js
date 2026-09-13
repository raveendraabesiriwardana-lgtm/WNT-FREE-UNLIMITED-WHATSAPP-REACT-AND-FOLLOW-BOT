const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');

// ===== CONFIG =====
const BOT_NAME = "WNT FREE UNLIMITED WHATSAPP REACT AND FOLLOW BOT";
const CHANNEL_LINK = "https://whatsapp.com/channel/0029VbA03M45Ui2Um3rPuE1C";
const CHANNEL_ID = "0029VbA03M45Ui2Um3rPuE1C@newsletter";
const PASSWORD = "bihadunethumnethsara2014226wnt";
const DATA_FILE = "./data.json";

// ===== DATA SAVE =====
function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        try { return JSON.parse(fs.readFileSync(DATA_FILE)); }
        catch (e) { return { blocked: [], postIds: [], autoReact: true }; }
    }
    return { blocked: [], postIds: [], autoReact: true };
}
function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
let db = loadData();

// ===== BOT INSTANCES =====
const bots = {};

// ===== CREATE BOT =====
function createBot(userId, phoneNumber, res) {
    if (bots[userId]) {
        return res.json({ error: "මේ user ට දැනටමත් bot එකක් තියෙනවා" });
    }

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: userId,
            dataPath: "./.wwebjs_auth"
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        }
    });

    let pairingCodeSent = false;

    client.on('qr', async () => {
        if (pairingCodeSent) return;
        pairingCodeSent = true;
        try {
            const code = await client.requestPairingCode(phoneNumber);
            console.log(`[${userId}] Pairing Code: ${code}`);
            if (res && !res.headersSent) {
                res.json({ success: true, code: code, userId: userId });
            }
        } catch (e) {
            console.log('Pairing error:', e.message);
            if (res && !res.headersSent) {
                res.json({ error: e.message });
            }
        }
    });

    client.on('ready', () => console.log(`[${userId}] Bot ready!`));
    client.on('authenticated', () => console.log(`[${userId}] Authenticated!`));
    client.on('auth_failure', (m) => { console.log(`[${userId}] Auth fail:`, m); delete bots[userId]; });
    client.on('disconnected', (r) => { console.log(`[${userId}] Disconnected:`, r); delete bots[userId]; });

    // ===== AUTO REACT ON CHANNEL POST =====
    client.on('message', async (msg) => {
        // Channel post එකක්ද බලන්න
        if (msg.from === CHANNEL_ID) {
            // Auto react (blocked නැත්නම්)
            const sender = msg.from;
            if (!db.blocked.includes(sender) && db.autoReact) {
                try {
                    await msg.react('❤️');
                    console.log(`[${userId}] Auto-reacted to channel post`);
                } catch (e) {
                    console.log('Auto-react error:', e.message);
                }
            }
        }
    });

    // ===== COMMAND HANDLER =====
    client.on('message', async (msg) => {
        const text = msg.body.trim();
        const sender = msg.from;

        // .menu
        if (text === '.menu') {
            const menu = `*${BOT_NAME}*\n\n` +
                `📌 *Commands:*\n\n` +
                `1️⃣ *.follow*\n   → Channel එක follow කරන්න\n\n` +
                `2️⃣ *.postid <channel post link>*\n   → Post එකේ ID එක ගන්න\n\n` +
                `3️⃣ *.create <post link>*\n   → Post එකකට react කරන්න\n\n` +
                `4️⃣ *.autoreact on/off*\n   → Auto react on/off කරන්න\n\n` +
                `5️⃣ *.dontreactandfollow <password>*\n   → Follow/React නවත්තන්න\n\n` +
                `6️⃣ *.menu*\n   → මේ menu එක පෙන්නන්න\n\n` +
                `🔗 Channel: ${CHANNEL_LINK}`;
            await msg.reply(menu);
            return;
        }

        // .follow
        if (text === '.follow') {
            if (db.blocked.includes(sender)) {
                await msg.reply('❌ ඔබ follow/react නවත්තලා තියෙනවා.');
                return;
            }
            try {
                await client.subscribeToChannel(CHANNEL_ID);
                await msg.reply(`✅ Channel එක follow කළා!\n${CHANNEL_LINK}`);
            } catch (e) {
                await msg.reply('❌ Follow කරන්න බැරි වුනා: ' + e.message);
            }
            return;
        }

        // .postid — channel post එකේ ID එක ගන්න
        if (text.startsWith('.postid')) {
            const parts = text.split(' ');
            if (parts.length < 2) {
                await msg.reply('❌ විදිය: *.postid <channel post link>*');
                return;
            }
            const link = parts[1];
            // Link එකෙන් post ID එක extract කරන්න
            // WhatsApp channel link format: 
            // https://whatsapp.com/channel/XXXX/YYYY
            const match = link.match(/channel\/([^\/]+)\/(\d+)/);
            if (match) {
                const channelId = match[1] + '@newsletter';
                const postId = match[2];
                const fullId = channelId + '_' + postId;
                if (!db.postIds.includes(fullId)) {
                    db.postIds.push(fullId);
                    saveData(db);
                }
                await msg.reply(`✅ Post ID එක ගත්තා!\n\n` +
                    `Channel: ${channelId}\n` +
                    `Post ID: ${postId}\n` +
                    `Full ID: ${fullId}\n\n` +
                    `දැන් *.create* එකෙන් react කරන්න පුළුවන්.`);
            } else {
                await msg.reply('❌ Link එක වැරදි. Format එක:\n' +
                    'https://whatsapp.com/channel/XXXX/YYYY');
            }
            return;
        }

        // .create — post එකකට react කරන්න
        if (text.startsWith('.create')) {
            if (db.blocked.includes(sender)) {
                await msg.reply('❌ ඔබ follow/react නවත්තලා තියෙනවා.');
                return;
            }
            const parts = text.split(' ');
            if (parts.length < 2) {
                await msg.reply('❌ විදිය: *.create <post link>*');
                return;
            }
            const link = parts[1];
            const match = link.match(/channel\/([^\/]+)\/(\d+)/);
            if (!match) {
                await msg.reply('❌ Link එක වැරදි. පළමුව *.postid* එකෙන් ID එක ගන්න.');
                return;
            }
            const channelId = match[1] + '@newsletter';
            const postId = match[2];
            const fullId = channelId + '_' + postId;

            try {
                // Channel post එකට react කරන්න try කරන්න
                // Note: මේක whatsapp-web.js වල experimental
                await client.sendReaction(fullId, '❤️');
                await msg.reply('✅ React කළා!');
            } catch (e) {
                await msg.reply('❌ React කරන්න බැරි වුනා: ' + e.message +
                    '\n\n(Note: channel post react එක experimental)');
            }
            return;
        }

        // .autoreact on/off
        if (text.startsWith('.autoreact')) {
            const parts = text.split(' ');
            if (parts.length < 2) {
                await msg.reply('❌ විදිය: *.autoreact on* හෝ *.autoreact off*');
                return;
            }
            if (parts[1] === 'on') {
                db.autoReact = true;
                saveData(db);
                await msg.reply('✅ Auto react ON');
            } else if (parts[1] === 'off') {
                db.autoReact = false;
                saveData(db);
                await msg.reply('✅ Auto react OFF');
            } else {
                await msg.reply('❌ on හෝ off විතරයි');
            }
            return;
        }

        // .dontreactandfollow
        if (text.startsWith('.dontreactandfollow')) {
            const parts = text.split(' ');
            if (parts.length < 2) {
                await msg.reply('❌ විදිය: *.dontreactandfollow <password>*');
                return;
            }
            if (parts[1] !== PASSWORD) {
                await msg.reply('❌ Password එක වැරදි!');
                return;
            }
            if (!db.blocked.includes(sender)) {
                db.blocked.push(sender);
                saveData(db);
            }
            await msg.reply('✅ ඔබ follow/react නවත්තලා තියෙනවා.');
            return;
        }
    });

    bots[userId] = client;
    client.initialize();
}

// ===== EXPRESS WEB =====
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>${BOT_NAME}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: Arial; background: #0b141a; color: #fff; 
                   display: flex; justify-content: center; align-items: center;
                   min-height: 100vh; margin: 0; padding: 20px; }
            .box { background: #111b21; padding: 30px; border-radius: 12px;
                   max-width: 400px; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
            h1 { color: #25d366; font-size: 18px; text-align: center; }
            input { width: 100%; padding: 12px; margin: 8px 0; border-radius: 8px;
                    border: 1px solid #2a3942; background: #202c33; color: #fff;
                    box-sizing: border-box; }
            button { width: 100%; padding: 12px; background: #25d366; color: #000;
                     border: none; border-radius: 8px; font-weight: bold; 
                     cursor: pointer; margin-top: 10px; }
            .code { background: #202c33; padding: 15px; border-radius: 8px;
                    text-align: center; font-size: 24px; letter-spacing: 3px;
                    color: #25d366; margin-top: 15px; font-weight: bold; }
            .info { font-size: 13px; color: #8696a0; margin-top: 15px; line-height: 1.6; }
            .err { color: #ff6b6b; text-align: center; margin-top: 10px; }
        </style>
    </head>
    <body>
        <div class="box">
            <h1>${BOT_NAME}</h1>
            <p style="text-align:center;color:#8696a0;font-size:14px;">
                Bot එක pair කරන්න ඔබේ WhatsApp number එක දාන්න
            </p>
            <form id="pairForm">
                <input type="text" id="number" placeholder="947XXXXXXXX" required>
                <button type="submit">Pair කරන්න</button>
            </form>
            <div id="result"></div>
            <div class="info">
                📱 WhatsApp → Linked Devices → Link with phone number<br>
                ඉහත code එක type කරන්න.
            </div>
        </div>
        <script>
            document.getElementById('pairForm').onsubmit = async (e) => {
                e.preventDefault();
                const number = document.getElementById('number').value.trim();
                const res = document.getElementById('result');
                res.innerHTML = '<p style="text-align:center">⏳ රැඳී සිටින්න...</p>';
                try {
                    const r = await fetch('/pair', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ number: number })
                    });
                    const data = await r.json();
                    if (data.code) {
                        res.innerHTML = '<div class="code">' + data.code + '</div>' +
                            '<p class="info">මේ code එක WhatsApp එකේ type කරන්න</p>';
                    } else {
                        res.innerHTML = '<p class="err">' + (data.error || 'Error') + '</p>';
                    }
                } catch (err) {
                    res.innerHTML = '<p class="err">' + err.message + '</p>';
                }
            };
        </script>
    </body>
    </html>
    `);
});

app.post('/pair', (req, res) => {
    const number = (req.body.number || '').replace(/[^0-9]/g, '');
    if (!number || number.length < 10) {
        return res.json({ error: 'Number එක වැරදි' });
    }
    createBot('user_' + number, number, res);
});

app.get('/status', (req, res) => {
    res.json({ bots: Object.keys(bots).length, blocked: db.blocked.length, postIds: db.postIds.length });
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Server running on port ' + (process.env.PORT || 3000));
});
