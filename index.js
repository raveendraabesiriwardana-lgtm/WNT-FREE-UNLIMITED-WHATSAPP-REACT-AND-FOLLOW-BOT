const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const express = require('express');

// ===== CONFIG =====
const BOT_NAME = "WNT FREE UNLIMITED WHATSAPP REACT AND FOLLOW BOT";
const CHANNEL_LINK = "https://whatsapp.com/channel/0029VbA03M45Ui2Um3rPuE1C";
const CHANNEL_ID = "0029VbA03M45Ui2Um3rPuE1C@newsletter";
const PASSWORD = "bihadunethumnethsara2014226wnt";
const PHONE_NUMBER = process.env.PHONE_NUMBER; // Heroku config var එකෙන් දෙන්න
const DATA_FILE = "./data.json";

// ===== DATA SAVE (Heroku disk) =====
function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        try { return JSON.parse(fs.readFileSync(DATA_FILE)); }
        catch (e) { return { blocked: [] }; }
    }
    return { blocked: [] };
}
function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
let db = loadData();

// ===== CLIENT =====
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: "./.wwebjs_auth"
    }),
    puppeteer: {
        headless: true,
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

// ===== PAIRING CODE =====
if (PHONE_NUMBER) {
    client.on('qr', async () => {
        // QR event එකේදී pairing code ඉල්ලනවා
        try {
            const pairingCode = await client.requestPairingCode(PHONE_NUMBER);
            console.log('=================================');
            console.log('PAIRING CODE: ' + pairingCode);
            console.log('=================================');
            console.log('WhatsApp → Linked Devices → Link with phone number');
            console.log('ඉහත code එක type කරන්න.');
        } catch (e) {
            console.log('Pairing code error:', e.message);
        }
    });
} else {
    // PHONE_NUMBER නැත්නම් QR පෙන්නනවා
    client.on('qr', (qr) => {
        console.log('QR Code:');
        qrcode.generate(qr, { small: true });
    });
}

client.on('ready', () => {
    console.log(`${BOT_NAME} ready!`);
});

client.on('authenticated', () => {
    console.log('Authenticated! Session disk එකේ save වුනා.');
});

client.on('auth_failure', (m) => {
    console.log('Auth fail:', m);
});

client.on('disconnected', (reason) => {
    console.log('Disconnected:', reason);
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
            `2️⃣ *.create <link>*\n   → Channel post එකකට react කරන්න\n\n` +
            `3️⃣ *.dontreactandfollow <password>*\n   → Follow/React නවත්තන්න\n\n` +
            `4️⃣ *.menu*\n   → මේ menu එක පෙන්නන්න\n\n` +
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

    // .create
    if (text.startsWith('.create')) {
        if (db.blocked.includes(sender)) {
            await msg.reply('❌ ඔබ follow/react නවත්තලා තියෙනවා.');
            return;
        }
        const parts = text.split(' ');
        if (parts.length < 2) {
            await msg.reply('❌ විදිය: *.create <channel post link>*');
            return;
        }
        const postLink = parts[1];
        await msg.reply('⏳ React කරනවා...\n(Note: channel post ID එක අවශ්‍යයි)');
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

client.initialize();

// ===== Heroku Web =====
const app = express();
app.get('/', (req, res) => res.send(`${BOT_NAME} running`));
app.get('/pair', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.send('number එක දෙන්න: /pair?number=947XXXXXXXX');
    try {
        const code = await client.requestPairingCode(number);
        res.send('Pairing Code: ' + code);
    } catch (e) {
        res.send('Error: ' + e.message);
    }
});
app.listen(process.env.PORT || 3000);
