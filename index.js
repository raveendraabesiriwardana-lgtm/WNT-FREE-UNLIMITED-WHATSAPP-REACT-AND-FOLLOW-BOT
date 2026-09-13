const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

// ===== AUTO-DETECT CHROME PATH =====
function findChromePath() {
    // Option 1: Environment variable (buildpack එකෙන් set කරනවා)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    if (process.env.GOOGLE_CHROME_BIN) {
        return process.env.GOOGLE_CHROME_BIN;
    }

    // Option 2: Heroku buildpack install කරන තැන්
    const buildpackPaths = [
        '/app/.apt/usr/bin/google-chrome',
        '/app/.apt/usr/bin/google-chrome-stable',
        '/app/.apt/usr/bin/chromium',
        '/app/.apt/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
    ];
    for (const p of buildpackPaths) {
        if (fs.existsSync(p)) {
            console.log('Chrome found at:', p);
            return p;
        }
    }

    // Option 3: Puppeteer cache (fallback)
    const cacheDir = '/app/.cache/puppeteer/chrome';
    if (fs.existsSync(cacheDir)) {
        try {
            const versions = fs.readdirSync(cacheDir);
            for (const ver of versions) {
                const chromePath = path.join(cacheDir, ver, 'chrome-linux64', 'chrome');
                if (fs.existsSync(chromePath)) {
                    console.log('Chrome found at:', chromePath);
                    return chromePath;
                }
            }
        } catch (e) {
            console.log('Chrome scan error:', e.message);
        }
    }

    console.log('Chrome not found!');
    return undefined;
}

const CHROME_PATH = findChromePath();
console.log('Using Chrome:', CHROME_PATH);

// ===== CONFIG =====
const BOT_NAME = "WNT FREE UNLIMITED WHATSAPP REACT AND FOLLOW BOT";
const CHANNEL_LINK = "https://whatsapp.com/channel/0029VbA03M45Ui2Um3rPuE1C";
const CHANNEL_ID = "0029VbA03M45Ui2Um3rPuE1C@newsletter";
const PASSWORD = "bihadunethumnethsara2014226wnt";
const DATA_FILE = "./data.json";

// ===== DATA =====
function defaultData() {
    return {
        blocked: [],
        totalUsers: [],
        followCount: {},
        reactCount: {},
        stats: { totalFollows: 0, totalReacts: 0 }
    };
}

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        try { return JSON.parse(fs.readFileSync(DATA_FILE)); }
        catch (e) { return defaultData(); }
    }
    return defaultData();
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let db = loadData();

// ===== BOT INSTANCES =====
const bots = {};

// ===== STATS UPDATE =====
function updateStats() {
    db.stats.totalFollows = Object.values(db.followCount).filter(v => v === true).length;
    db.stats.totalReacts = Object.values(db.reactCount).filter(v => v === true).length;
    saveData(db);
}

// ===== CREATE BOT =====
function createBot(userId, phoneNumber, res) {
    if (bots[userId]) {
        if (res && !res.headersSent) {
            return res.json({ error: "මේ user ට දැනටමත් bot එකක් තියෙනවා" });
        }
        return;
    }

    // User list එකට add
    if (!db.totalUsers.includes(userId)) {
        db.totalUsers.push(userId);
        saveData(db);
    }

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: userId,
            dataPath: "./.wwebjs_auth"
        }),
        puppeteer: {
            headless: true,
            executablePath: CHROME_PATH,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
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
    client.on('auth_failure', (m) => {
        console.log(`[${userId}] Auth fail:`, m);
        delete bots[userId];
    });
    client.on('disconnected', (r) => {
        console.log(`[${userId}] Disconnected:`, r);
        delete bots[userId];
    });

    // ===== MESSAGE HANDLER =====
    client.on('message', async (msg) => {
        const text = msg.body.trim();
        const sender = msg.from;

        // .menu
        if (text === '.menu') {
            const menu = `*${BOT_NAME}*\n\n` +
                `📌 *Commands:*\n\n` +
                `1️⃣ *.follow*\n   → Channel එක follow කරන්න\n\n` +
                `2️⃣ *.postid <link>*\n   → Post ID එක ගන්න\n\n` +
                `3️⃣ *.create <link>*\n   → Post එකට react කරන්න\n\n` +
                `4️⃣ *.stats*\n   → මුළු users, follow, react ගාන බලන්න\n\n` +
                `5️⃣ *.dontreactandfollow <password>*\n   → Follow/React නවත්තන්න\n\n` +
                `6️⃣ *.menu*\n   → මේ menu එක\n\n` +
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
                db.followCount[userId] = true;
                updateStats();

                const totalUsers = db.totalUsers.length;
                const followed = db.stats.totalFollows;
                const remaining = totalUsers - followed;

                await msg.reply(
                    `✅ *Channel එක follow කළා!*\n\n` +
                    `📊 *Follow Statistics:*\n` +
                    `👥 මුළු users: ${totalUsers}\n` +
                    `✅ Follow කරපු: ${followed}\n` +
                    `❌ ඉතිරි: ${remaining}\n\n` +
                    `🔗 ${CHANNEL_LINK}`
                );
            } catch (e) {
                await msg.reply('❌ Follow කරන්න බැරි වුනා: ' + e.message);
            }
            return;
        }

        // .postid
        if (text.startsWith('.postid')) {
            const parts = text.split(' ');
            if (parts.length < 2) {
                await msg.reply('❌ විදිය: *.postid <channel post link>*');
                return;
            }
            const link = parts[1];
            const match = link.match(/channel\/([^\/]+)\/(\d+)/);
            if (match) {
                const fullId = match[1] + '@newsletter_' + match[2];
                await msg.reply(
                    `✅ *Post ID එක ගත්තා!*\n\n` +
                    `Channel: ${match[1]}\n` +
                    `Post ID: ${match[2]}\n` +
                    `Full ID: ${fullId}\n\n` +
                    `දැන් *.create* එකෙන් react කරන්න පුළුවන්.`
                );
            } else {
                await msg.reply('❌ Link එක වැරදි. Format: https://whatsapp.com/channel/XXXX/YYYY');
            }
            return;
        }

        // .create
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
            const fullId = match[1] + '@newsletter_' + match[2];

            try {
                await client.sendReaction(fullId, '❤️');
                db.reactCount[userId] = true;
                updateStats();

                const totalUsers = db.totalUsers.length;
                const reacted = db.stats.totalReacts;
                const remaining = totalUsers - reacted;

                await msg.reply(
                    `✅ *React කළා!*\n\n` +
                    `📊 *React Statistics:*\n` +
                    `👥 මුළු users: ${totalUsers}\n` +
                    `✅ React කරපු: ${reacted}\n` +
                    `❌ ඉතිරි: ${remaining}\n\n` +
                    `❤️ Post: ${fullId}`
                );
            } catch (e) {
                await msg.reply('❌ React කරන්න බැරි වුනා: ' + e.message +
                    '\n\n(Note: channel post react එක experimental)');
            }
            return;
        }

        // .stats
        if (text === '.stats') {
            const totalUsers = db.totalUsers.length;
            const followed = db.stats.totalFollows;
            const reacted = db.stats.totalReacts;
            const followRemaining = totalUsers - followed;
            const reactRemaining = totalUsers - reacted;
            const blocked = db.blocked.length;

            await msg.reply(
                `*${BOT_NAME}*\n` +
                `📊 *Statistics*\n\n` +
                `👥 *මුළු users:* ${totalUsers}\n` +
                `🚫 *Blocked users:* ${blocked}\n\n` +
                `📌 *Follow:*\n` +
                `✅ Follow කරපු: ${followed}\n` +
                `❌ ඉතිරි: ${followRemaining}\n\n` +
                `❤️ *React:*\n` +
                `✅ React කරපු: ${reacted}\n` +
                `❌ ඉතිරි: ${reactRemaining}\n\n` +
                `🔗 ${CHANNEL_LINK}`
            );
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

    // ===== SAFE INITIALIZE =====
    try {
        client.initialize();
    } catch (e) {
        console.log('Initialize error:', e.message);
        if (res && !res.headersSent) {
            res.json({ error: 'Bot start කරන්න බැරි වුනා: ' + e.message });
        }
    }
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
            .stats { background: #202c33; padding: 15px; border-radius: 8px; margin-top: 15px; }
            .stats p { margin: 5px 0; font-size: 14px; }
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
            <div class="stats" id="statsBox"></div>
            <div class="info">
                📱 WhatsApp → Linked Devices → Link with phone number
            </div>
        </div>
        <script>
            async function loadStats() {
                try {
                    const r = await fetch('/stats');
                    const d = await r.json();
                    document.getElementById('statsBox').innerHTML =
                        '<p>👥 මුළු users: ' + d.totalUsers + '</p>' +
                        '<p>✅ Follow කරපු: ' + d.totalFollows + '</p>' +
                        '<p>❤️ React කරපු: ' + d.totalReacts + '</p>' +
                        '<p>🚫 Blocked: ' + d.blocked + '</p>';
                } catch(e) {}
            }
            loadStats();
            setInterval(loadStats, 5000);

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
                    const text = await r.text();
                    let data;
                    try { data = JSON.parse(text); }
                    catch (err) {
                        res.innerHTML = '<p class="err">Server error. Heroku logs බලන්න.</p>';
                        return;
                    }
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

app.get('/stats', (req, res) => {
    updateStats();
    res.json({
        totalUsers: db.totalUsers.length,
        totalFollows: db.stats.totalFollows,
        totalReacts: db.stats.totalReacts,
        blocked: db.blocked.length
    });
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Server running on port ' + (process.env.PORT || 3000));
});
