const TelegramBot = require('node-telegram-bot-api');

// Configure your Telegram bot token and chat ID here
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID_HERE';

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }
  
  try {
    const { message, studentName, teacherName } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }
    
    console.log('Received submission from:', studentName, 'Teacher:', teacherName);
    console.log('Message length:', message.length);
    
    // Initialize Telegram bot
    const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);
    
    // Split message if it's too long for Telegram (max 4096 characters)
    const maxLength = 4000;
    const messages = [];
    
    if (message.length > maxLength) {
      let start = 0;
      while (start < message.length) {
        // Try to split at a newline near the max length
        let end = start + maxLength;
        if (end < message.length) {
          // Find the last newline before max length
          const lastNewline = message.lastIndexOf('\n', end);
          if (lastNewline > start + maxLength * 0.8) {
            end = lastNewline;
          }
        } else {
          end = message.length;
        }
        
        messages.push(message.substring(start, end));
        start = end;
      }
    } else {
      messages.push(message);
    }
    
    // Send messages to Telegram
    const results = [];
    
    for (let i = 0; i < messages.length; i++) {
      try {
        const partMessage = messages[i];
        const partLabel = messages.length > 1 ? ` (Part ${i + 1}/${messages.length})` : '';
        
        await bot.sendMessage(TELEGRAM_CHAT_ID, partMessage, {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        });
        
        results.push({ part: i + 1, success: true });
        console.log(`Telegram message part ${i + 1} sent successfully`);
        
        // Add a small delay between messages to avoid rate limiting
        if (i < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Error sending part ${i + 1}:`, error.message);
        results.push({ part: i + 1, success: false, error: error.message });
      }
    }
    
    // Check if all parts were sent successfully
    const allSuccessful = results.every(r => r.success);
    
    // Also log to console for debugging
    console.log('='.repeat(50));
    console.log('IELTS TEST SUBMISSION LOGGED');
    console.log('Student:', studentName);
    console.log('Teacher:', teacherName);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Telegram Results:', JSON.stringify(results, null, 2));
    console.log('='.repeat(50));
    
    if (allSuccessful) {
      return res.status(200).json({ 
        success: true, 
        message: 'Test submitted and sent to Telegram successfully',
        details: {
          studentName,
          teacherName,
          timestamp: new Date().toISOString(),
          messageParts: messages.length,
          results
        }
      });
    } else {
      return res.status(207).json({ 
        success: false, 
        error: 'Some parts failed to send',
        details: {
          studentName,
          teacherName,
          timestamp: new Date().toISOString(),
          results
        }
      });
    }
    
  } catch (error) {
    console.error('Error in Telegram API:', error);
    
    // Return success even if Telegram fails, but log the error
    return res.status(200).json({ 
      success: false, 
      error: error.message,
      note: 'Test was submitted locally but failed to send to Telegram. Please check bot configuration.',
      fallback: true
    });
  }
};
