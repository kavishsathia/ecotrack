#!/usr/bin/env python3
"""
Life App Telegram Bot - Product Lifecycle Tracking

This bot allows users to track their product lifecycle events by sending
images and text descriptions. The bot identifies products and creates
lifecycle steps in the Life app.
"""

import os
import logging
import asyncio
import aiohttp
import base64
from io import BytesIO
from typing import Optional, Dict, Any

from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
    ConversationHandler
)
from telegram.constants import ParseMode

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Bot configuration
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
print(BOT_TOKEN)
API_BASE_URL = os.getenv('LIFE_APP_API_URL', 'https://localhost:3000/api')
BOT_SECRET = os.getenv('TELEGRAM_BOT_SECRET')

# Conversation states
WAITING_FOR_EVENT = 1
WAITING_FOR_IMAGE = 2
WAITING_FOR_DESCRIPTION = 3


class LifeBot:
    def __init__(self):
        self.app = Application.builder().token(BOT_TOKEN).build()
        self.setup_handlers()

    def setup_handlers(self):
        """Set up bot command and message handlers"""

        # Commands
        self.app.add_handler(CommandHandler("start", self.start_command))
        self.app.add_handler(CommandHandler("help", self.help_command))
        self.app.add_handler(CommandHandler("link", self.link_command))
        self.app.add_handler(CommandHandler("status", self.status_command))
        self.app.add_handler(CommandHandler("products", self.products_command))

        # Conversation handler for lifecycle events
        conv_handler = ConversationHandler(
            entry_points=[
                MessageHandler(filters.PHOTO, self.handle_photo),
                MessageHandler(filters.TEXT & ~filters.COMMAND,
                               self.handle_text_only)
            ],
            states={
                WAITING_FOR_EVENT: [
                    MessageHandler(filters.TEXT, self.process_lifecycle_event)
                ],
                WAITING_FOR_DESCRIPTION: [
                    MessageHandler(filters.TEXT, self.process_lifecycle_event)
                ]
            },
            fallbacks=[CommandHandler("cancel", self.cancel_command)]
        )

        self.app.add_handler(conv_handler)

        # Error handler
        self.app.add_error_handler(self.error_handler)

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command"""
        user = update.effective_user
        welcome_message = f"""
🌱 *Welcome to Life App Lifecycle Tracker!*

Hi {user.first_name}! I help you track your product lifecycle events.

*What I can do:*
📸 Analyze product photos
📝 Process lifecycle events (broken, repaired, sold, etc.)
🔗 Connect with your Life app account
📊 Track sustainability metrics

*To get started:*
1. Link your account: /link
2. Send me a photo of your product + description
3. I'll automatically track the lifecycle event!

*Commands:*
/help - Show this help message
/link - Link your Telegram to Life app
/status - Check your account status
/products - See your tracked products
/cancel - Cancel current operation

Ready to start tracking? Send me a photo! 📸
        """

        await update.message.reply_text(
            welcome_message,
            parse_mode=ParseMode.MARKDOWN
        )

    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /help command"""
        help_text = """
🤖 *Life App Bot Help*

*How to use:*
1. Send a photo of your product with a description
2. I'll identify the product and understand what happened
3. The event gets recorded in your Life app!

*Example messages:*
📸 + "My laptop is broken" → Records malfunction
📸 + "Fixed my headphones" → Records repair
📸 + "Sold my phone" → Records sale
📸 + "This vacuum works great!" → Records positive update

*Supported events:*
🔴 Malfunction, broken, stopped working
🔧 Repaired, fixed, serviced
🛒 Purchased, bought, acquired
♻️ Recycled, disposed, thrown away
🎁 Sold, gifted, donated
⬆️ Upgraded, modified, improved
🧽 Cleaned, maintained
✅ Working well, no issues

*Commands:*
/start - Welcome message
/help - This help
/link - Link account
/status - Account status
/products - Your products
/cancel - Cancel operation

Need help? Contact support in the Life app! 💚
        """

        await update.message.reply_text(
            help_text,
            parse_mode=ParseMode.MARKDOWN
        )

    async def link_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /link command - provides instructions for linking account"""
        user = update.effective_user
        telegram_id = str(user.id)
        username = user.username or "No username"

        link_message = f"""
🔗 *Link Your Life App Account*

To connect this Telegram account with your Life app:

*Your Telegram Info:*
• ID: `{telegram_id}`
• Username: @{username}
• Name: {user.first_name} {user.last_name or ""}

*Steps to link:*
1. Open the Life app on your browser
2. Go to Settings → Telegram Integration
3. Enter your Telegram ID: `{telegram_id}`
4. Click "Link Account"
5. Return here and use /status to verify

*Why link?*
✅ Track lifecycle events automatically
✅ Match products from your tracking list
✅ Sync data with your Life app dashboard
✅ Get personalized insights

Once linked, just send photos + descriptions! 📸
        """

        await update.message.reply_text(
            link_message,
            parse_mode=ParseMode.MARKDOWN
        )

    async def status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Check user's account linking status"""
        user = update.effective_user
        telegram_id = str(user.id)

        # Check if user is linked by making API call
        status_info = await self.check_user_status(telegram_id)

        if status_info['linked']:
            status_message = f"""
✅ *Account Status: Linked*

*Your Info:*
• Telegram ID: `{telegram_id}`
• Life App User: {status_info['name']}
• Tracked Products: {status_info['tracked_count']}
• Linked Since: {status_info['linked_date']}

*Recent Activity:*
{status_info['recent_activity']}

🎉 You're all set! Send me photos to track events.
            """
        else:
            status_message = f"""
❌ *Account Status: Not Linked*

Your Telegram account is not yet connected to the Life app.

*To link your account:*
1. Use /link for instructions
2. Go to Life app → Settings → Telegram
3. Enter your ID: `{telegram_id}`

Need help? Check /help for more info!
            """

        await update.message.reply_text(
            status_message,
            parse_mode=ParseMode.MARKDOWN
        )

    async def products_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show user's tracked products"""
        user = update.effective_user
        telegram_id = str(user.id)

        products_info = await self.get_user_products(telegram_id)

        if not products_info['linked']:
            await update.message.reply_text(
                "❌ Account not linked. Use /link to connect your account first!",
                parse_mode=ParseMode.MARKDOWN
            )
            return

        if products_info['products']:
            products_list = "\n".join([
                f"• {p['name']} (Score: {p['ecoScore']}/100)"
                for p in products_info['products']
            ])

            products_message = f"""
📦 *Your Tracked Products*

{products_list}

*Total Products:* {len(products_info['products'])}
*Average Eco Score:* {products_info['avg_score']}/100

💡 Send me photos of these products with descriptions to track lifecycle events!
            """
        else:
            products_message = """
📦 *No Products Tracked Yet*

You haven't tracked any products in the Life app yet.

*To start tracking:*
1. Visit Life app in your browser
2. Use the browser extension or manual tracking
3. Come back here to report lifecycle events!

🌱 Start your sustainability journey today!
            """

        await update.message.reply_text(
            products_message,
            parse_mode=ParseMode.MARKDOWN
        )

    async def handle_photo(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle photo messages - start lifecycle event processing"""
        await update.message.reply_text(
            "📸 Great! I see you've sent a photo. Now tell me what happened with this product:",
            reply_markup=ReplyKeyboardMarkup([
                ["🔴 Broken/Not Working", "🔧 Fixed/Repaired"],
                ["🛒 Just Bought", "♻️ Recycled/Disposed"],
                ["🎁 Sold/Gifted", "⬆️ Upgraded/Modified"],
                ["🧽 Cleaned/Maintained", "✅ Working Great"],
                ["📝 Custom Description"]
            ], resize_keyboard=True, one_time_keyboard=True)
        )

        # Store photo info in context
        photo = update.message.photo[-1]  # Get highest resolution
        context.user_data['photo_file_id'] = photo.file_id
        context.user_data['photo_size'] = photo.file_size

        return WAITING_FOR_DESCRIPTION

    async def handle_text_only(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle text-only messages"""
        await update.message.reply_text(
            "📝 I see you've described something. For better product identification, could you also send a photo?\n\n" +
            "Or if you want to proceed with text only, I'll try to match based on your description:",
            reply_markup=ReplyKeyboardMarkup([
                ["📸 I'll send a photo", "📝 Continue with text only"]
            ], resize_keyboard=True, one_time_keyboard=True)
        )

        context.user_data['text_description'] = update.message.text
        return WAITING_FOR_EVENT

    async def process_lifecycle_event(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Process the lifecycle event with photo and description"""
        user = update.effective_user
        telegram_id = str(user.id)

        # Get description from user
        description = update.message.text

        # Handle quick reply buttons
        if description in ["🔴 Broken/Not Working", "🔧 Fixed/Repaired", "🛒 Just Bought",
                           "♻️ Recycled/Disposed", "🎁 Sold/Gifted", "⬆️ Upgraded/Modified",
                           "🧽 Cleaned/Maintained", "✅ Working Great"]:
            # Convert emoji buttons to descriptive text
            description_mapping = {
                "🔴 Broken/Not Working": "This product is broken and not working properly",
                "🔧 Fixed/Repaired": "I fixed and repaired this product, it's working now",
                "🛒 Just Bought": "I just purchased this product",
                "♻️ Recycled/Disposed": "I recycled or disposed of this product",
                "🎁 Sold/Gifted": "I sold or gave away this product",
                "⬆️ Upgraded/Modified": "I upgraded or modified this product",
                "🧽 Cleaned/Maintained": "I cleaned and maintained this product",
                "✅ Working Great": "This product is working great with no issues"
            }
            description = description_mapping.get(description, description)
        elif description == "📝 Custom Description":
            await update.message.reply_text(
                "Please describe what happened with your product:",
                reply_markup=ReplyKeyboardRemove()
            )
            return WAITING_FOR_DESCRIPTION
        elif description == "📸 I'll send a photo":
            await update.message.reply_text(
                "Perfect! Please send a photo of your product:",
                reply_markup=ReplyKeyboardRemove()
            )
            return WAITING_FOR_IMAGE
        elif description == "📝 Continue with text only":
            description = context.user_data.get(
                'text_description', description)

        # Show processing message
        processing_msg = await update.message.reply_text(
            "🔄 Processing your lifecycle event...\n" +
            "• Analyzing content\n" +
            "• Matching products\n" +
            "• Creating lifecycle step",
            reply_markup=ReplyKeyboardRemove()
        )

        try:
            # Get photo data if available
            image_data = None
            if 'photo_file_id' in context.user_data:
                image_data = await self.get_photo_data(
                    context,
                    context.user_data['photo_file_id']
                )

            # Send to API
            result = await self.send_to_api(telegram_id, description, image_data)

            # Debug log the response
            logger.info(f"API response: {result}")

            if result and result.get('success', False):
                success_message = f"""
✅ *Lifecycle Event Recorded!*

*Product:* {result['matchedProduct']['name']}
*Event:* {result['lifecycleStep']['title']}
*Match Confidence:* {result['matchInfo']['confidence']}%

{result['matchInfo']['message']}

*Description:* {result['lifecycleStep']['description']}

🌱 Check your Life app dashboard to see the full timeline!
                """

                try:
                    await processing_msg.edit_text(
                        success_message,
                        parse_mode=ParseMode.MARKDOWN
                    )
                except Exception as edit_error:
                    # If editing fails, send a new message instead
                    logger.warning(f"Could not edit message: {edit_error}")
                    await update.message.reply_text(
                        success_message,
                        parse_mode=ParseMode.MARKDOWN
                    )
            else:
                error_message = f"❌ {result.get('message', result.get('error', 'Failed to process event'))}"
                try:
                    await processing_msg.edit_text(error_message)
                except Exception as edit_error:
                    # If editing fails, send a new message instead
                    logger.warning(f"Could not edit message: {edit_error}")
                    await update.message.reply_text(error_message)

        except Exception as e:
            logger.error(f"Error processing lifecycle event: {e}")
            try:
                await processing_msg.edit_text(
                    "❌ Sorry, something went wrong processing your event. Please try again later."
                )
            except Exception as edit_error:
                # If editing fails, send a new message instead
                logger.warning(f"Could not edit message: {edit_error}")
                await update.message.reply_text(
                    "❌ Sorry, something went wrong processing your event. Please try again later."
                )

        # Clear context data
        context.user_data.clear()
        return ConversationHandler.END

    async def cancel_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Cancel current operation"""
        context.user_data.clear()
        await update.message.reply_text(
            "❌ Operation cancelled. Send me a photo anytime to track a lifecycle event!",
            reply_markup=ReplyKeyboardRemove()
        )
        return ConversationHandler.END

    async def get_photo_data(self, context: ContextTypes.DEFAULT_TYPE, file_id: str) -> Optional[str]:
        """Download photo and convert to base64"""
        try:
            file = await context.bot.get_file(file_id)
            photo_bytes = await file.download_as_bytearray()

            # Convert to base64
            photo_base64 = base64.b64encode(photo_bytes).decode('utf-8')
            return f"data:image/jpeg;base64,{photo_base64}"

        except Exception as e:
            logger.error(f"Error downloading photo: {e}")
            return None

    async def send_to_api(self, telegram_id: str, text: str, image_data: Optional[str]) -> Dict[str, Any]:
        """Send lifecycle event to Life app API"""
        payload = {
            "telegramId": telegram_id,
            "text": text,
            "botToken": BOT_SECRET,
            "timestamp": int(asyncio.get_event_loop().time())
        }

        if image_data:
            payload["imageBase64"] = image_data

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{API_BASE_URL}/lifecycle/telegram-event",
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                print(await response.json())
                return await response.json()

    async def check_user_status(self, telegram_id: str) -> Dict[str, Any]:
        """Check if user is linked and get account info"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{API_BASE_URL}/telegram/status",
                    params={"telegramId": telegram_id}
                ) as response:
                    data = await response.json()

                    if data.get('linked'):
                        return {
                            "linked": True,
                            "name": data['user']['name'] or 'Unknown',
                            "tracked_count": data['stats']['trackedProducts'],
                            "linked_date": data['user']['linkedAt'],
                            "recent_activity": self.format_recent_activity(data.get('recentActivity', []))
                        }
                    else:
                        return {
                            "linked": False,
                            "name": "Unknown",
                            "tracked_count": 0,
                            "linked_date": "Not linked",
                            "recent_activity": "No recent activity"
                        }
        except Exception as e:
            logger.error(f"Error checking user status: {e}")
            return {
                "linked": False,
                "name": "Unknown",
                "tracked_count": 0,
                "linked_date": "Error checking status",
                "recent_activity": "Unable to fetch activity"
            }

    async def get_user_products(self, telegram_id: str) -> Dict[str, Any]:
        """Get user's tracked products"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{API_BASE_URL}/telegram/products",
                    params={"telegramId": telegram_id}
                ) as response:
                    data = await response.json()

                    if data.get('linked'):
                        return {
                            "linked": True,
                            # Limit to first 10
                            "products": data['products'][:10],
                            "avg_score": data['stats']['avgEcoScore']
                        }
                    else:
                        return {
                            "linked": False,
                            "products": [],
                            "avg_score": 0
                        }
        except Exception as e:
            logger.error(f"Error fetching user products: {e}")
            return {
                "linked": False,
                "products": [],
                "avg_score": 0
            }

    def format_recent_activity(self, activities: list) -> str:
        """Format recent activity for display"""
        if not activities:
            return "No recent activity"

        activity_lines = []
        for activity in activities[:3]:  # Show only last 3
            icon = activity.get('stepIcon', '📝')
            product = activity.get('productName', 'Product')
            event = activity.get('stepLabel', 'Event')
            activity_lines.append(f"{icon} {event}: {product}")

        return "\n".join(activity_lines)

    async def error_handler(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle errors"""
        logger.error(f"Exception while handling an update: {context.error}")

        if update and update.effective_message:
            await update.effective_message.reply_text(
                "❌ Sorry, something went wrong. Please try again or contact support."
            )

    def run(self):
        """Start the bot"""
        logger.info("Starting Life App Telegram Bot...")
        self.app.run_polling()


def main():
    """Main entry point"""
    if not BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not found in environment variables")
        return

    if not BOT_SECRET:
        logger.error("TELEGRAM_BOT_SECRET not found in environment variables")
        return

    bot = LifeBot()
    bot.run()


if __name__ == "__main__":
    main()
