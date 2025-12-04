require('dotenv').config({ path: '../.env' });
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// เก็บสถานะปาร์ตี้ (Host, Link, คนเข้าร่วม)
let currentParty = {
    isActive: false,
    host: null,
    link: null,
    participants: new Set()
};

client.once('ready', () => {
    console.log(`🍿 Watch Party Bot is Online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- คำสั่งสร้างห้อง (!watch <Link>) ---
    if (message.content.toLowerCase().startsWith('!watch')) {
        const args = message.content.split(' ');
        const link = args[1];

        if (!link) return message.reply("⚠️ Usage: `!watch <YouTube/Video Link>`");

        // Reset & Setup Party ใหม่
        currentParty = {
            isActive: true,
            host: message.author.id,
            link: link,
            participants: new Set([message.author.id])
        };

        const embed = new EmbedBuilder()
            .setColor(0x0099ff) // สีฟ้าธีม Movie
            .setTitle('🎬 Phantom Watch Party')
            .setDescription(`**Host:** ${message.author}\n**Link:** ${link}\n\nClick **Join** to get ready for the sync countdown!`)
            .addFields({ name: 'Participants', value: '1 warrior waiting...' })
            .setFooter({ text: 'Host can click "Start Countdown" when ready.' });

        // สร้างปุ่มกด 2 ปุ่ม (Join / Start)
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('join_party')
                .setLabel('🍿 Join Party')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('start_party')
                .setLabel('▶️ Start Countdown')
                .setStyle(ButtonStyle.Success)
        );

        await message.channel.send({ embeds: [embed], components: [row] });
    }
});

// --- ส่วนจัดการปุ่มกด (Interaction) ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (!currentParty.isActive) {
        return interaction.reply({ content: "❌ No active party found.", ephemeral: true });
    }

    // ปุ่ม Join
    if (interaction.customId === 'join_party') {
        if (currentParty.participants.has(interaction.user.id)) {
            return interaction.reply({ content: "You are already in the party!", ephemeral: true });
        }

        currentParty.participants.add(interaction.user.id);

        // อัปเดตจำนวนคนในการ์ด (Real-time update)
        const count = currentParty.participants.size;

        // ดึง Embed เดิมมาแก้
        const originalEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setFields({ name: 'Participants', value: `${count} warriors ready!` });

        await interaction.update({ embeds: [updatedEmbed] });
    }

    // ปุ่ม Start (เฉพาะ Host กดได้)
    if (interaction.customId === 'start_party') {
        if (interaction.user.id !== currentParty.host) {
            return interaction.reply({ content: "👮 Only the Host can start the countdown!", ephemeral: true });
        }

        // ลบปุ่มออกเพื่อเริ่มนับถอยหลัง
        await interaction.update({ components: [] });
        const channel = interaction.channel;

        // นับถอยหลัง 3... 2... 1...
        await channel.send(`🚨 **SYNC COUNTDOWN INITIATED** 🚨\nOpen this link now: ${currentParty.link}`);

        setTimeout(() => channel.send("3..."), 1000);
        setTimeout(() => channel.send("2..."), 2000);
        setTimeout(() => channel.send("1..."), 3000);
        setTimeout(() => {
            channel.send("▶️ **PLAY NOW!** 🎬");
            const mentions = Array.from(currentParty.participants).map(id => `<@${id}>`).join(' ');
            channel.send(`(Enjoy the show! ${mentions})`);

            // จบงาน
            currentParty.isActive = false;
        }, 4000);
    }
});

client.login(process.env.WATCH_PARTY_TOKEN);