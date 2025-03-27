const { Telegraf } = require('telegraf');
const ytdl = require('ytdl-core');
const stream = require('stream');

// Environment variable for the bot token
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN environment variable is missing.');
  process.exit(1);
}

// Initialize the bot
const bot = new Telegraf(BOT_TOKEN);

// Helper function to validate YouTube URL
const isValidYouTubeUrl = (url) => {
  const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=)?([a-zA-Z0-9_-]{11})/;
  return regex.test(url);
};

// Helper function to convert a readable stream to a Telegram-compatible stream
const streamToTelegram = (readableStream) => {
  const passthrough = new stream.PassThrough();
  readableStream.pipe(passthrough);
  return passthrough;
};

// Main handler for Vercel serverless function
module.exports = async (req, res) => {
  try {
    // Handle non-POST requests (e.g., health checks)
    if (req.method !== 'POST') {
      return res.status(200).send('Bot is running.');
    }

    // Parse the incoming Telegram update
    const update = req.body;
    const chatId = update.message?.chat?.id;
    const text = update.message?.text;

    if (!chatId || !text) {
      return res.status(400).json({ error: 'Invalid update.' });
    }

    // Handle /start command
    if (text === '/start') {
      await bot.telegram.sendMessage(
        chatId,
        'Welcome to the YouTube Video Downloader Bot! 🎥\n\n' +
        'Send me a YouTube video URL, and I’ll download and send the video to you.\n' +
        'Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ\n\n' +
        'Note: Due to Telegram limits, videos should be under 50 MB.'
      );
      return res.status(200).json({ ok: true });
    }

    // Validate the URL
    if (!isValidYouTubeUrl(text)) {
      await bot.telegram.sendMessage(
        chatId,
        'Please send a valid YouTube URL.\n' +
        'Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      );
      return res.status(200).json({ ok: true });
    }

    // Send a "processing" message
    const processingMessage = await bot.telegram.sendMessage(chatId, 'Processing your video... ⏳');

    try {
      // Get video info
      const videoInfo = await ytdl.getInfo(text);
      const videoTitle = videoInfo.videoDetails.title;

      // Choose the lowest quality format to minimize file size
      const format = ytdl.chooseFormat(videoInfo.formats, {
        quality: 'lowestvideo',
        filter: 'videoandaudio',
      });

      if (!format) {
        await bot.telegram.editMessageText(
          chatId,
          processingMessage.message_id,
          null,
          'Sorry, I couldn’t find a suitable video format to download.'
        );
        return res.status(200).json({ ok: true });
      }

      // Check approximate file size (if available)
      const contentLength = format.contentLength ? parseInt(format.contentLength) : null;
      if (contentLength && contentLength > 50 * 1024 * 1024) { // 50 MB limit
        await bot.telegram.editMessageText(
          chatId,
          processingMessage.message_id,
          null,
          'The video is too large (over 50 MB). Please try a shorter video or a different URL.'
        );
        return res.status(200).json({ ok: true });
      }

      // Download the video as a stream
      const videoStream = ytdl(text, {
        quality: 'lowestvideo',
        filter: 'videoandaudio',
      });

      // Convert the stream for Telegram
      const telegramStream = streamToTelegram(videoStream);

      // Send the video to the user
      await bot.telegram.sendVideo(
        chatId,
        { source: telegramStream },
        {
          caption: `🎥 ${videoTitle}`,
          supports_streaming: true,
        }
      );

      // Update the processing message
      await bot.telegram.editMessageText(
        chatId,
        processingMessage.message_id,
        null,
        'Video sent successfully! ✅'
      );

    } catch (error) {
      console.error('Error downloading video:', error.message);
      await bot.telegram.editMessageText(
        chatId,
        processingMessage.message_id,
        null,
        'An error occurred while downloading the video. Please try again or use a different URL.'
      );
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Error in bot:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
