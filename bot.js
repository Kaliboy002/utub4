const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

// Replace with your Telegram Bot Token from BotFather
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Replace with your Vercel deployment URL
const API_URL = process.env.API_URL || 'https://your-project.vercel.app/api/download';

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Send me a YouTube URL and I\'ll download the video for you!');
});

// Handle YouTube URL messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const url = msg.text;

    // Skip if it's a command
    if (url.startsWith('/')) return;

    // Validate URL
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        bot.sendMessage(chatId, 'Please send a valid YouTube URL!');
        return;
    }

    try {
        // Send loading message
        const loadingMsg = await bot.sendMessage(chatId, 'Downloading video... Please wait.');

        // Make request to our video downloader API
        const response = await axios({
            method: 'POST',
            url: API_URL,
            data: { url },
            responseType: 'stream',
            headers: { 'Content-Type': 'application/json' }
        });

        // Send video to user
        await bot.sendVideo(chatId, response.data, {
            caption: 'Here\'s your video!',
            supports_streaming: true
        });

        // Delete loading message
        await bot.deleteMessage(chatId, loadingMsg.message_id);

    } catch (error) {
        console.error('Error:', error);
        bot.sendMessage(chatId, 'Sorry, I couldn\'t download that video. Try another URL!');
    }
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

console.log('Bot is running...');
