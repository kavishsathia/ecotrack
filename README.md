# EcoTrack - Your AI Sustainability Companion

A comprehensive platform for tracking product lifecycles with sustainability insights, powered by AI analysis and multi-platform integration.

## Features

- 🌱 **Product Lifecycle Tracking** - Track your products from purchase to disposal
- 🤖 **AI-Powered Analysis** - OpenAI integration for product analysis and lifecycle insights
- 📱 **Telegram Bot Integration** - Report lifecycle events via Telegram
- 🌐 **Chrome Extension** - Track products directly from web pages
- 📊 **Rolling Summaries** - AI-generated summaries every 50 lifecycle steps
- 🔐 **SingPass Authentication** - Singapore government authentication
- ♻️ **Sustainability Scoring** - EcoScore tracking and recommendations
- 📈 **Analytics Dashboard** - Comprehensive insights and reporting

## Architecture

- **Frontend**: Next.js 14 with TypeScript, TailwindCSS, Shadcn/ui
- **Backend**: Next.js API routes with Prisma ORM
- **Database**: PostgreSQL (Neon)
- **Authentication**: Stack Auth + SingPass OAuth
- **AI Integration**: OpenAI GPT-4o-mini, Gemini API
- **Extensions**: Chrome Extension, Telegram Bot (Python)

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Neon recommended)
- OpenAI API key
- Python 3.8+ (for Telegram bot)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd ecotrack
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Fill in your environment variables in `.env`:

#### Required Variables
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key for AI features
- `NEXTAUTH_URL` - Your app URL (http://localhost:3080)
- `NEXTAUTH_SECRET` - Random secret key (32+ characters)

#### Optional Variables
- `TELEGRAM_BOT_TOKEN` - For Telegram integration
- `TELEGRAM_BOT_SECRET` - Webhook authentication
- `SINGPASS_CLIENT_ID` - For SingPass authentication
- `SINGPASS_CLIENT_SECRET` - SingPass client secret
- `GEMINI_API_KEY` - Google Gemini API key

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# (Optional) Seed sample data
npx prisma db seed
```

### 4. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3080`

## Chrome Extension Setup

### Development Mode

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `chrome-extension` folder
4. The extension will appear in your extensions list

### Usage
- Click the extension icon on any product page
- The extension will analyze the page and allow you to track the product
- Lifecycle events can be viewed in the web dashboard

## Telegram Bot Setup

### 1. Install Python Dependencies

```bash
cd telegram-bot
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Bot

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Add `TELEGRAM_BOT_TOKEN` to your `.env`
3. Set `TELEGRAM_BOT_SECRET` to a secure random string
4. Update `LIFE_APP_API_URL` in `.env` to your API URL

### 3. Run Bot

```bash
cd telegram-bot
source venv/bin/activate
python main.py
```

### 4. Link Telegram Account

Use the web dashboard to link your Telegram account, then start using the bot:
- Send photos of products with descriptions
- Use quick action buttons for common events
- Type `/help` for available commands

## API Endpoints

### Core APIs
- `POST /api/products/track` - Track a new product
- `GET /api/products/my-products` - Get user's tracked products
- `POST /api/products/analyze` - Analyze product from content
- `GET /api/products/recommend` - Get product recommendations

### Lifecycle APIs
- `POST /api/lifecycle/telegram-event` - Process Telegram bot events
- `GET /api/products/[id]/lifecycle/summary` - Get AI lifecycle summary
- `POST /api/lifecycle/generate-summary` - Generate new summary

### Authentication APIs
- `POST /api/auth/login` - User login
- `GET /api/auth/callback` - SingPass OAuth callback
- `POST /api/telegram/link` - Link Telegram account

## Database Schema

Key models:
- **User** - User accounts with SingPass and Telegram linking
- **Product** - Product catalog with sustainability metrics
- **ProductTracking** - User-product tracking relationships
- **ProductLifecycleStep** - Individual lifecycle events
- **ProductLifecycleSummary** - AI-generated summaries every 50 steps

## Development Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Database operations
npx prisma studio              # Database GUI
npx prisma db push            # Push schema changes
npx prisma generate           # Generate client
npx prisma db seed           # Seed sample data

# AI Summary generation
npm run generate-summaries    # Generate summaries for existing data
```

## Environment Variables Reference

### Database
- `DATABASE_URL` - Primary database connection
- `DATABASE_URL_UNPOOLED` - Direct connection without pooling

### Authentication
- `NEXTAUTH_URL` - Application URL
- `NEXTAUTH_SECRET` - NextAuth secret key
- `SINGPASS_CLIENT_ID` - SingPass OAuth client ID
- `SINGPASS_CLIENT_SECRET` - SingPass OAuth secret
- `SINGPASS_ENVIRONMENT` - sandbox/production

### AI Services
- `OPENAI_API_KEY` - OpenAI API key (required)
- `GEMINI_API_KEY` - Google Gemini API key (optional)

### Telegram Integration
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `TELEGRAM_BOT_SECRET` - Security token for webhooks
- `LIFE_APP_API_URL` - API base URL for bot communication

### Stack Auth
- `NEXT_PUBLIC_STACK_PROJECT_ID` - Stack Auth project ID
- `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` - Public client key
- `STACK_SECRET_SERVER_KEY` - Server secret key

## Deployment

### Vercel Deployment

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Ensure `NEXTAUTH_URL` points to your production URL
4. Deploy

### Database Deployment

The app is configured for Neon PostgreSQL. Update connection strings in your environment variables for production.

### Chrome Extension Deployment

1. Build the extension for production
2. Upload to Chrome Web Store
3. Update `CHROME_EXTENSION_ID` in production environment

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and ensure builds pass
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed description

---

Built with ❤️ using Next.js, TypeScript, and modern web technologies.
