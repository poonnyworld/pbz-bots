require('dotenv').config({ path: '../.env' });
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder, // ✨ เพิ่มตัวนี้
    ButtonBuilder,    // ✨ เพิ่มตัวนี้
    ButtonStyle       // ✨ เพิ่มตัวนี้
} = require('discord.js');
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

    // --- 🎲 คำสั่งวัดดวง (!flip <amount> <side>) ---
    if (message.content.toLowerCase().startsWith('!flip')) {
        const args = message.content.split(' ');
        const betArg = args[1];
        const sideArg = args[2];

        // Config
        const MAX_BET = 500;
        const DAILY_FLIP_LIMIT = 5;

        // 1. เช็คกติกา (ถ้าพิมพ์ผิดหรือไม่ครบ)
        if (!betArg || !sideArg) {
            const ruleEmbed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🎲 Coin Flip Guide')
                .setDescription('**Risk your souls to double your wealth.**')
                .addFields(
                    { name: '📝 Syntax', value: '`!flip <amount> <head/tail>`\nExample: `!flip 100 h`', inline: false },
                    { name: '🏆 Winning', value: 'Correct guess = **x2** Souls (Win 100 -> Get 200)', inline: true },
                    { name: '💀 Losing', value: 'Wrong guess = **Lose all** bet amount.', inline: true },
                    { name: '⚖️ Limits', value: `Max Bet: **${MAX_BET}**\nLimit: **${DAILY_FLIP_LIMIT} times/day**`, inline: false }
                )
                .setFooter({ text: 'Luck favors the bold.' });

            return message.channel.send({ embeds: [ruleEmbed] });
        }

        // 2. Validation
        const bet = parseInt(betArg);
        if (isNaN(bet) || bet <= 0) return message.reply("⚠️ Invalid amount.");
        if (bet > MAX_BET) return message.reply(`⛔ **Limit Exceeded!** Max bet is **${MAX_BET}** souls.`);

        let userChoice = sideArg.toLowerCase();
        const validHeads = ['heads', 'head', 'h'];
        const validTails = ['tails', 'tail', 't'];

        if (!validHeads.includes(userChoice) && !validTails.includes(userChoice)) {
            return message.reply("⚠️ Choose side: **h** (Heads) or **t** (Tails)");
        }
        userChoice = validHeads.includes(userChoice) ? 'heads' : 'tails';

        try {
            const user = await prisma.user.findUnique({ where: { id: message.author.id } });
            if (!user || user.points < bet) return message.reply("❌ Not enough souls!");

            // เช็ค Daily Limit
            const now = new Date();
            const lastReset = new Date(user.lastFlipReset);
            if (now.toDateString() !== lastReset.toDateString()) {
                await prisma.user.update({ where: { id: user.id }, data: { flipCount: 0, lastFlipReset: now } });
                user.flipCount = 0;
            }
            if (user.flipCount >= DAILY_FLIP_LIMIT) {
                return message.reply(`⛔ **Daily Limit Reached!** (${DAILY_FLIP_LIMIT}/${DAILY_FLIP_LIMIT})`);
            }

            // --- 3. เริ่มเกม (Countdown Animation) ---
            const suspenseMsg = await message.reply(`🪙 **${message.author.username}** bets **${bet}** on **${userChoice.toUpperCase()}**...`);

            // นับถอยหลัง 3..2..1.. (แก้ไขข้อความเดิม)
            setTimeout(() => suspenseMsg.edit(`🪙 The coin is spinning... **3**`), 1000);
            setTimeout(() => suspenseMsg.edit(`🪙 The coin is spinning... **2**`), 2000);
            setTimeout(() => suspenseMsg.edit(`🪙 The coin is spinning... **1**`), 3000);

            // คำนวณผล
            const isHeads = Math.random() < 0.5;
            const resultSide = isHeads ? 'heads' : 'tails';
            const win = (userChoice === resultSide);

            // อัปเดต DB
            let finalPoints = 0;
            if (win) {
                const updated = await prisma.user.update({
                    where: { id: user.id },
                    data: { points: { increment: bet }, flipCount: { increment: 1 } }
                });
                finalPoints = updated.points;
            } else {
                const updated = await prisma.user.update({
                    where: { id: user.id },
                    data: { points: { decrement: bet }, flipCount: { increment: 1 } }
                });
                finalPoints = updated.points;
            }

            // เฉลยผล (วินาทีที่ 4)
            setTimeout(async () => {
                const coinEmoji = isHeads ? '🌕 HEADS' : '🌑 TAILS';
                const resultEmbed = new EmbedBuilder()
                    .setColor(win ? 0x57F287 : 0xED4245) // เขียว หรือ แดง
                    .setTitle(win ? `🎉 VICTORY! (+${bet})` : `💀 DEFEAT (-${bet})`)
                    .setDescription(`Result: **${coinEmoji}**\nBalance: **${finalPoints}** souls\nDaily: ${user.flipCount + 1}/${DAILY_FLIP_LIMIT}`)

                await suspenseMsg.edit({ content: ' ', embeds: [resultEmbed] });
            }, 4000);

        } catch (error) {
            console.error(error);
        }
    }

    // --- 🎪 ศูนย์รวมเกม (!game) พร้อมปุ่มกด ---
    if (message.content.toLowerCase() === '!game') {
        const gameEmbed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('🎪 The Order\'s Playground')
            .setDescription('Select a game below to see the rules.')
            .addFields(
                { name: 'Available Games', value: '• **Coin Flip**: Double or Nothing\n• **Daily**: Free souls', inline: true }
            );

        // สร้างปุ่ม
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('rules_flip')
                .setLabel('🎲 Coin Flip')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('rules_daily')
                .setLabel('📅 Daily Reward')
                .setStyle(ButtonStyle.Secondary)
        );

        await message.channel.send({ embeds: [gameEmbed], components: [row] });
    }
});

// --- 👇 เพิ่มส่วนนี้ต่อท้าย (นอก client.on messageCreate) 👇 ---
// Logic สำหรับจัดการปุ่มกดใน !game
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // กติกา Flip (เห็นแค่คนกด)
    if (interaction.customId === 'rules_flip') {
        await interaction.reply({
            content: `**🎲 Coin Flip Rules**\nType: \`!flip <amount> <side>\`\n• Choose **h** (Heads) or **t** (Tails)\n• Win: x2 payout\n• Lose: Bet lost\n• Max Bet: 500 | Limit: 5 times/day`,
            ephemeral: true // 👁️ เห็นแค่คนเดียว
        });
    }

    // กติกา Daily (เห็นแค่คนกด)
    if (interaction.customId === 'rules_daily') {
        await interaction.reply({
            content: `**📅 Daily Check-in**\nType: \`!daily\`\n• Get **50 souls** every 24 hours.\n• Reset time depends on your last claim.`,
            ephemeral: true // 👁️ เห็นแค่คนเดียว
        });
    }

});

client.login(process.env.HONOR_BOT_TOKEN);