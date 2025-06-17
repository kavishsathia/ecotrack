# Life App Telegram Bot

A Telegram bot that enables users to track product lifecycle events by sending photos and descriptions. The bot uses computer vision to identify products and automatically creates lifecycle steps in the Life app.

## Features

- 📸 **Photo Analysis**: Identify products from images using computer vision
- 🤖 **Natural Language Processing**: Understand lifecycle events from text descriptions
- 🔗 **Account Linking**: Connect Telegram users to Life app accounts
- 📊 **Smart Matching**: Match products against user's tracking list using embeddings
- 🎯 **Event Classification**: Automatically categorize events (malfunction, repair, disposal, etc.)

## Supported Lifecycle Events

- 🔴 **Malfunction**: broken, not working, stopped working, failed
- 🔧 **Repair**: repaired, fixed, working again, serviced
- 🛒 **Purchase**: bought, purchased, acquired, new
- ♻️ **Disposal**: recycled, disposed, thrown away, discarded
- 🎁 **Transfer**: sold, gifted, donated, gave away
- ⬆️ **Upgrade**: upgraded, improved, enhanced, modified
- 🧽 **Maintenance**: cleaned, maintained, serviced
- ✅ **Status Update**: working well, no issues, excellent

## Setup Instructions

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow instructions
3. Get your bot token
4. Save the token for configuration

### 2. Install Dependencies

```bash
cd telegram-bot
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
- `TELEGRAM_BOT_TOKEN`: Your bot token from BotFather
- `TELEGRAM_BOT_SECRET`: Secret key for API authentication
- `LIFE_APP_API_URL`: URL of your Life app API (default: http://localhost:3000/api)

### 4. Run the Bot

```bash
python main.py
```

## Bot Commands

- `/start` - Welcome message and setup instructions
- `/help` - Detailed help and usage examples
- `/link` - Instructions for linking Telegram to Life app account
- `/status` - Check account linking status
- `/products` - View tracked products
- `/cancel` - Cancel current operation

## Usage Examples

### Basic Usage
1. Send a photo of your product
2. Add a description of what happened
3. Bot identifies the product and creates a lifecycle step

### Example Messages
- 📸 + "My laptop is broken" → Records malfunction
- 📸 + "Fixed my headphones" → Records repair  
- 📸 + "Sold my phone" → Records sale
- 📸 + "This vacuum works great!" → Records positive update

## API Integration

The bot communicates with the Life app via the `/api/lifecycle/telegram-event` endpoint:

```json
{
  "telegramId": "123456789",
  "text": "My laptop is broken",
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQ...",
  "botToken": "secret_key",
  "timestamp": 1640995200
}
```

Response includes:
- Identified product match
- Created lifecycle step
- Match confidence and reasoning

## Architecture

```
Telegram User → Bot → Computer Vision → Product Matching → Life App API → Database
```

1. **Input Processing**: Receive photo + text from user
2. **Image Analysis**: Use OpenAI Vision API to identify product
3. **Product Matching**: Find best match from user's tracked products using embeddings
4. **Event Classification**: Determine lifecycle event type from text
5. **Database Update**: Create lifecycle step in Life app database
6. **User Feedback**: Confirm event recording with match details

## Development

### Local Development

1. Ensure Life app is running on `localhost:3000`
2. Set `LIFE_APP_API_URL=http://localhost:3000/api`
3. Run bot: `python main.py`
4. Test with your Telegram account

### Production Deployment

Recommended platforms:
- **Railway**: Simple deployment with environment variables
- **Heroku**: Free tier available
- **DigitalOcean**: App Platform
- **AWS**: Lambda + API Gateway

### Environment Variables

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOT_SECRET=your_secret_key
LIFE_APP_API_URL=https://your-life-app.com/api
ENVIRONMENT=production
```

## Security

- Bot token authentication for API calls
- User verification through Telegram ID
- Rate limiting on API endpoints
- Input validation and sanitization

## Error Handling

- Graceful fallback when computer vision fails
- Clear error messages for users
- Logging for debugging and monitoring
- Retry mechanisms for API calls

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with local setup
5. Submit a pull request

## Support

For issues or questions:
1. Check the Life app documentation
2. Review bot logs for errors
3. Test API endpoints manually
4. Contact support through the Life app