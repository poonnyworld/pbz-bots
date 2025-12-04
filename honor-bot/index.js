require('dotenv').config({ path: '../.env' });
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const express = require('express'); // 1. เรียก Express
const cors = require('cors');       // 2. เรียก CORS
const bcrypt = require('bcrypt');
const session = require('express-session');

const prisma = new PrismaClient();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

// --- ส่วนของ WEB API (Express) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());        // อนุญาตให้เว็บอื่นยิงเข้ามาได้
app.use(express.json()); // อ่าน JSON จาก Body ได้
app.use(express.static('public'));

// 🔐 ตั้งค่า Session
app.use(session({
    secret: 'phantom-blade-secret-key', // เปลี่ยนเป็นอะไรก็ได้ที่ยาวๆ
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 } // Login อยู่ได้ 1 ชั่วโมง
}));

// 🛡️ Middleware: ด่านตรวจคนเข้าเมือง (Admin Only)
const requireAuth = (req, res, next) => {
    if (req.session.adminId) {
        next(); // ผ่านไปได้
    } else {
        res.status(401).json({ error: "Unauthorized: Please login first" });
    }
};

// --- AUTH SYSTEM (Simplified) ---

// API: Login (เช็คกับ .env โดยตรง)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.adminId = 'fixed_admin_session';
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

// API: Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// API: Check Auth
app.get('/api/check-auth', (req, res) => {
    res.json({ loggedIn: !!req.session.adminId });
});

// --- DATA API (ใส่ requireAuth ดักไว้ทุกอัน!) ---

// A. Users
app.get('/api/users', requireAuth, async (req, res) => {
    const users = await prisma.user.findMany({ orderBy: { points: 'desc' } });
    res.json(users);
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { points } = req.body;
    try {
        const updated = await prisma.user.update({
            where: { id: id },
            data: { points: parseInt(points) }
        });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: "Update failed" }); }
});

// B. Items
app.get('/api/items', requireAuth, async (req, res) => {
    const items = await prisma.item.findMany({ orderBy: { id: 'asc' } });
    res.json(items);
});

app.post('/api/items', requireAuth, async (req, res) => {
    const { name, cost, description } = req.body;
    try {
        const newItem = await prisma.item.create({
            data: { name, cost: parseInt(cost), description, stock: -1, isActive: true }
        });
        res.json(newItem);
    } catch (e) { res.status(500).json({ error: "Create failed" }); }
});

// ✅ ใส่ส่วนนี้คืนให้ครับ (Edit Item)
app.put('/api/items/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { name, cost, description, stock, isActive } = req.body;
    try {
        const updated = await prisma.item.update({
            where: { id: parseInt(id) },
            data: {
                name,
                cost: parseInt(cost),
                description,
                stock: parseInt(stock),
                isActive: isActive
            }
        });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: "Update failed" }); }
});

app.listen(PORT, () => console.log(`🌐 Dashboard running on port ${PORT}`));

// --- ส่วนของ DISCORD BOT (Logic เดิม) ---
client.once('ready', () => {
    console.log(`🗡️  Honor Bot is Online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // ✅ ของใหม่: ถ้าไม่ใช่คำสั่ง (!) ค่อยแจกแต้ม
    if (!message.content.startsWith('!')) {
        try {
            await prisma.user.upsert({
                where: { id: message.author.id },
                update: {
                    points: { increment: 1 },
                    username: message.author.username
                },
                create: {
                    id: message.author.id,
                    username: message.author.username,
                    points: 1
                }
            });
        } catch (error) {
            console.error("Error updating DB:", error);
        }
    }

    // --- คำสั่งลงทะเบียนเริ่มต้น (!start) ---
    if (message.content.toLowerCase() === '!start') {
        try {
            // 1. เช็คก่อนว่ามีชื่อในระบบหรือยัง?
            const existingUser = await prisma.user.findUnique({
                where: { id: message.author.id }
            });

            if (existingUser) {
                return message.reply(`⚔️ **Warrior ${message.author.username}**, your name is already inscribed in the Order.`);
            }

            // 2. ถ้ายังไม่มี ให้สร้างใหม่เลย
            await prisma.user.create({
                data: {
                    id: message.author.id,
                    username: message.author.username,
                    points: 10 // ✨ แถมแต้มต้อนรับให้ 10 แต้ม (แก้เป็น 0 ได้ถ้าไม่อยากแจก)
                }
            });

            await message.reply(`📜 **Welcome to the Order!**\nYou have been registered with **10 starting souls**. Use \`!shop\` to view rewards.`);
            console.log(`New user registered: ${message.author.username}`);

        } catch (error) {
            console.error("Register Error:", error);
            await message.reply("❌ Failed to register. The scroll seems torn.");
        }
    }

    if (message.content.toLowerCase() === '!honor') {
        const user = await prisma.user.findUnique({
            where: { id: message.author.id }
        });
        await message.reply(`🥷 **${message.author.username}**, you have **${user?.points || 0}** souls.`);
    }

    // --- คำสั่งดูรายการของรางวัล (!shop) ---
    if (message.content.toLowerCase() === '!shop') {
        try {
            // 1. ดึงของรางวัลจาก DB (เอาเฉพาะที่ Active)
            const items = await prisma.item.findMany({
                where: { isActive: true },
                orderBy: { cost: 'asc' } // เรียงตามราคาถูกไปแพง
            });

            if (items.length === 0) {
                return message.reply("🎒 The Order's supply is currently empty.");
            }

            // 2. สร้าง Embed (การ์ด)
            const shopEmbed = new EmbedBuilder()
                .setColor(0xff4d4d) // สีแดงธีม Phantom Blade
                .setTitle('🎒 The Order\'s Exchange Registry')
                .setDescription('Redeem your accumulated **Souls** for these rewards.')
                .setTimestamp()
                .setFooter({ text: 'Use !buy <Item ID> to redeem (Coming Soon)' });

            // 3. วนลูปเอาข้อมูลสินค้าใส่ลงในการ์ด
            items.forEach(item => {
                const stockMsg = item.stock === -1 ? 'unlimited' : `${item.stock} left`;
                // ใส่ [ ] ครอบ Object ไว้ เพื่อบอกว่าเป็น Array
                shopEmbed.addFields([
                    {
                        name: `📦 ${item.name} (ID: ${item.id})`,
                        value: `💰 **${item.cost}** Souls\n📝 ${item.description || '-'}\nstock: ${stockMsg}`,
                        inline: true
                    }
                ]);
            });

            // 4. ส่งกลับไปในห้องแชท
            await message.channel.send({ embeds: [shopEmbed] });

        } catch (error) {
            console.error("Error fetching shop:", error);
            await message.reply("Failed to open the shop registry.");
        }
    }

    // --- คำสั่งซื้อของ (!buy <Item_ID>) ---
    // เช็คด้วย startsWith เพราะต้องมี ID ต่อท้าย
    if (message.content.toLowerCase().startsWith('!buy')) {
        const args = message.content.split(' ');
        const itemId = parseInt(args[1]);

        // 1. เช็คว่าใส่เลข ID มาไหม
        if (isNaN(itemId)) {
            return message.reply("⚠️ Usage: `!buy <Item ID>` (Check Item ID from !shop command)");
        }

        try {
            // 2. ดึงข้อมูล User และ Item มารอไว้
            const user = await prisma.user.findUnique({ where: { id: message.author.id } });
            const item = await prisma.item.findUnique({ where: { id: itemId } });

            // 3. Validation Checks (ดัก Error ต่างๆ)
            if (!item || !item.isActive) {
                return message.reply("❌ Item not found or unavailable.");
            }
            if (item.stock === 0) {
                return message.reply("❌ This item is Out of Stock!");
            }
            if (user.points < item.cost) {
                return message.reply(`❌ Not enough souls! You need **${item.cost}** but have only **${user.points}**.`);
            }

            // 4. เริ่ม Transaction (ตัดแต้ม + ลดของ + เก็บประวัติ) 
            // *สำคัญมาก* ต้องทำพร้อมกัน ถ้าพังต้อง Rollback หมด
            await prisma.$transaction(async (tx) => {
                // A. ตัดแต้มคนซื้อ
                await tx.user.update({
                    where: { id: user.id },
                    data: { points: { decrement: item.cost } }
                });

                // B. ลดสต็อก (ถ้าไม่ใช่ -1)
                if (item.stock !== -1) {
                    await tx.item.update({
                        where: { id: item.id },
                        data: { stock: { decrement: 1 } }
                    });
                }

                // C. บันทึกประวัติการแลก (Redemption Log)
                await tx.redemption.create({
                    data: {
                        userId: user.id,
                        itemId: item.id,
                        cost: item.cost
                    }
                });
            });

            // 5. แจ้งผลสำเร็จ
            await message.reply(`✅ **Deal Sealed!** You have redeemed **${item.name}** for ${item.cost} souls.`);
            console.log(`User ${user.username} redeemed ${item.name}`);

        } catch (error) {
            console.error("Buy Error:", error);
            await message.reply("❌ An error occurred while processing the transaction.");
        }
    }

    // --- 📅 คำสั่งรับแต้มรายวัน (!daily) ---
    if (message.content.toLowerCase() === '!daily') {
        try {
            const user = await prisma.user.findUnique({ where: { id: message.author.id } });

            // เช็คว่ามี User หรือยัง
            if (!user) return message.reply("⚠️ You are not registered. Type `!start` first.");

            // เช็ค Cooldown (24 ชั่วโมง)
            const now = new Date();
            const lastDaily = user.lastDaily ? new Date(user.lastDaily) : new Date(0);
            const diffTime = Math.abs(now - lastDaily);
            const hoursPassed = diffTime / (1000 * 60 * 60);

            if (hoursPassed < 24) {
                const waitHours = Math.floor(24 - hoursPassed);
                return message.reply(`⏳ You must wait **${waitHours} hours** to claim your daily souls.`);
            }

            // แจกแต้ม (เช่น 50 แต้ม)
            const reward = 50;
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    points: { increment: reward },
                    lastDaily: now
                }
            });

            await message.reply(`🌞 **Blessing Received!** You gained **${reward} souls**. Come back tomorrow.`);

        } catch (error) {
            console.error(error);
        }
    }

    // --- 🎲 คำสั่งวัดดวง (!flip <amount> <side>) [Updated Logic] ---
    if (message.content.toLowerCase().startsWith('!flip')) {
        const args = message.content.split(' ');
        const betArg = args[1];
        const sideArg = args[2];

        // ⚙️ ตั้งค่าความโหด (Config)
        const MAX_BET = 500;        // แทงสูงสุดต่อตา
        const DAILY_FLIP_LIMIT = 5; // เล่นได้วันละกี่ครั้ง

        // 1. เช็คกติกาเบื้องต้น
        if (!betArg || !sideArg) {
            const ruleEmbed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🎲 Coin Flip Rules')
                .setDescription('Test your luck with the Order\'s coin.')
                .addFields(
                    { name: 'How to Play', value: 'Type `!flip <amount> <heads/tails>`\nEx: `!flip 100 h`', inline: false },
                    { name: 'Limits', value: `• Max Bet: **${MAX_BET}** souls\n• Daily Limit: **${DAILY_FLIP_LIMIT}** times/day`, inline: false }, // อัปเดตกติกาตรงนี้
                    { name: 'Win/Lose', value: 'Win = **2x** payoff. Lose = Souls consumed.', inline: false }
                )
                .setFooter({ text: 'Play responsibly. The Order watches.' });

            return message.channel.send({ embeds: [ruleEmbed] });
        }

        const bet = parseInt(betArg);
        if (isNaN(bet) || bet <= 0) return message.reply("⚠️ Invalid amount.");

        // 🚨 ป้องกันเงินเฟ้อ 1: ห้ามแทงเกินลิมิต
        if (bet > MAX_BET) return message.reply(`⛔ **Limit Exceeded!** You can only bet up to **${MAX_BET}** souls.`);

        // ตรวจสอบฝั่ง
        let userChoice = sideArg.toLowerCase();
        const validHeads = ['heads', 'head', 'h'];
        const validTails = ['tails', 'tail', 't'];
        if (!validHeads.includes(userChoice) && !validTails.includes(userChoice)) return message.reply("⚠️ Invalid side. Choose **h** or **t**.");
        userChoice = validHeads.includes(userChoice) ? 'heads' : 'tails';

        try {
            const user = await prisma.user.findUnique({ where: { id: message.author.id } });
            if (!user || user.points < bet) return message.reply("❌ Not enough souls!");

            // 🚨 ป้องกันเงินเฟ้อ 2: เช็คจำนวนครั้งต่อวัน
            const now = new Date();
            const lastReset = new Date(user.lastFlipReset);

            // ถ้าเป็นวันใหม่ (เทียบแค่วัน/เดือน/ปี) ให้รีเซ็ต
            if (now.toDateString() !== lastReset.toDateString()) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { flipCount: 0, lastFlipReset: now }
                });
                user.flipCount = 0; // อัปเดตตัวแปร local ด้วย
            }

            if (user.flipCount >= DAILY_FLIP_LIMIT) {
                return message.reply(`⛔ **Daily Limit Reached!** You have played ${DAILY_FLIP_LIMIT}/${DAILY_FLIP_LIMIT} times today. Come back tomorrow.`);
            }

            // --- เริ่มเกม (อนิเมชั่น) ---
            const suspenseMsg = await message.reply(`🪙 **${message.author.username}** bets **${bet}** on **${userChoice.toUpperCase()}**...\nThe coin is in the air... *spinning*...`);

            // คำนวณผล
            const isHeads = Math.random() < 0.5;
            const resultSide = isHeads ? 'heads' : 'tails';
            const win = (userChoice === resultSide);

            let finalPoints = 0;

            // อัปเดต DB (ตัดเงิน/เพิ่มเงิน + เพิ่มรอบการเล่น)
            if (win) {
                const updated = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        points: { increment: bet },
                        flipCount: { increment: 1 },
                        lastFlipReset: now
                    }
                });
                finalPoints = updated.points;
            } else {
                const updated = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        points: { decrement: bet },
                        flipCount: { increment: 1 },
                        lastFlipReset: now
                    }
                });
                finalPoints = updated.points;
            }

            // เฉลยผล
            setTimeout(async () => {
                const coinEmoji = isHeads ? '🌕' : '🌑';
                if (win) {
                    await suspenseMsg.edit(`🪙 Result: **${resultSide.toUpperCase()}** ${coinEmoji}\n🎉 **VICTORY!** Correct! You won **${bet} souls**. (Total: ${finalPoints})\n(Played: ${user.flipCount + 1}/${DAILY_FLIP_LIMIT} today)`);
                } else {
                    await suspenseMsg.edit(`🪙 Result: **${resultSide.toUpperCase()}** ${coinEmoji}\n💀 **DEFEAT...** Wrong guess. You lost **${bet} souls**. (Total: ${finalPoints})\n(Played: ${user.flipCount + 1}/${DAILY_FLIP_LIMIT} today)`);
                }
            }, 2000);

        } catch (error) {
            console.error(error);
            message.reply("❌ System Error.");
        }
    }

    // --- 🎮 ศูนย์รวมเกม (!game) ---
    if (message.content.toLowerCase() === '!game') {
        const gameEmbed = new EmbedBuilder()
            .setColor(0x9b59b6) // สีม่วงดูลึกลับ
            .setTitle('🎪 The Order\'s Playground')
            .setDescription('Select an activity to earn (or lose) souls.')
            .addFields(
                { name: '📅 Daily Check-in', value: '`!daily`\nGet free souls every 24h.', inline: true },
                { name: '🎲 Coin Flip', value: '`!flip`\nDouble your bet. 50/50 chance.', inline: true },
                { name: '🔜 Coming Soon', value: 'Slots, Duel, Bounty Hunt', inline: true }
            )
            .setFooter({ text: 'Use the commands above to play.' });

        // สร้างปุ่ม (Optional: ถ้าอยากให้กดแล้วโชว์กติกาเกมนั้นๆ)
        /* const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('help_flip').setLabel('Coin Rules').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('help_daily').setLabel('Daily Info').setStyle(ButtonStyle.Secondary)
        );
        */

        // ส่งแค่ Embed ไปก่อนเพื่อความเรียบง่าย
        await message.channel.send({ embeds: [gameEmbed] });
    }

});

client.login(process.env.HONOR_BOT_TOKEN);