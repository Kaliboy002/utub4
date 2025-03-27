const TelegramBot = require('node-telegram-bot-api');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

// Initialize bot with token from environment
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token);

// Temporary directory (Vercel provides /tmp)
const TEMP_DIR = '/tmp';

// Vercel serverless function
module.exports = async (req, res) => {
    // Handle webhook updates
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Process Telegram update
        const update = req.body;
        const message = update.message;
        if (!message || !message.text) {
            return res.status(200).end(); // Silent success for irrelevant updates
        }

        const chatId = message.chat.id;
        const url = message.text.trim();

        // Handle /start command
        if (url === '/start') {
            await bot.sendMessage(chatId, 'Send me a YouTube URL, and I’ll send you the video!');
            return res.status(200).end();
        }

        // Validate YouTube URL
        if (!url.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/)) {
            await bot.sendMessage(chatId, 'Please send a valid YouTube URL!');
            return res.status(200).end();
        }

        // Send loading message
        const loadingMsg = await bot.sendMessage(chatId, 'Downloading video... Please wait.');

        // Get video info and download
        const info = await ytdl.getInfo(url);
        const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        const filePath = path.join(TEMP_DIR, `${videoTitle}.mp4`);

        await new Promise((resolve, reject) => {
            ytdl(url, {
                quality: 'highest',
                filter: 'audioandvideo'
            })
                .pipe(fs.createWriteStream(filePath))
                .on('finish', resolve)
                .on('error', reject);
        });

        // Check file size (Telegram limit: 50MB)
        const stats = fs.statSync(filePath);
        if (stats.size > 50 * 1024 * 1024) {
            fs.unlinkSync(filePath);
            await bot.deleteMessage(chatId, loadingMsg.message_id);
            await bot.sendMessage(chatId, 'Video is too large (>50MB). Try a shorter video!');
            return res.status(200).end();
        }

        // Send video
        await bot.sendVideo(chatId, filePath, {
            caption: 'Here’s your video!',
            supports_streaming: true
        });

        // Clean up
        fs.unlinkSync(filePath);
        await bot.deleteMessage(chatId, loadingMsg.message_id);

        res.status(200).end();

    } catch (error) {
        console.error('Error:', error.message);
        if (req.body?.message?.chat?.id) {
            await bot.sendMessage(req.body.message.chat.id, 'Failed to download video. Try another URL!');
        }
        res.status(200).end(); // Telegram expects 200 even on errors
    }
};

// Set webhook on first deployment (run locally once or via Vercel env setup)
if (process.env.NODE_ENV === 'development') {
    const setWebhook = async () => {
        const url = process.env.VERCEL_URL || 'https://your-vercel-project.vercel.app/api/bot';
        await bot.setWebHook(url);
        console.log(`Webhook set to ${url}`);
    };
    setWebhook();
                }
