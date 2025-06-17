import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getStepTypeInfo,
  USER_LIFECYCLE_STEPS,
  LifecycleStepType,
} from "@/lib/lifecycle-types";
import { TelegramProductMatcher } from "@/lib/telegram-product-matcher";
import { LifecycleSummaryService } from "@/lib/lifecycle-summary";

// Request validation schema for Telegram bot webhook
const telegramEventSchema = z.object({
  telegramId: z.string(), // Telegram user ID
  text: z.string().optional(), // User's text description
  imageUrl: z.string().optional(), // URL to uploaded image
  imageBase64: z.string().optional(), // Base64 encoded image data
  timestamp: z.number().optional(),
  botToken: z.string(), // Bot authentication token
});

// Product identification result from computer vision
interface ProductIdentificationResult {
  productName: string;
  category: string;
  confidence: number;
  description: string;
  condition?: string;
  brand?: string;
}

// Lifecycle event analysis result
interface LifecycleEventAnalysis {
  stepType: LifecycleStepType;
  title: string;
  description: string;
  confidence: number;
  extractedInfo: {
    condition?: string;
    issueType?: string;
    repairType?: string;
    location?: string;
    cost?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Add CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    const body = await request.json();

    // Validate input
    const validationResult = telegramEventSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.issues,
        },
        { status: 400, headers }
      );
    }

    const { telegramId, text, imageUrl, imageBase64, botToken } =
      validationResult.data;

    // Verify bot token (basic security)
    if (botToken !== process.env.TELEGRAM_BOT_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    // Find user by Telegram ID
    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "User not found",
          message: "Please link your Telegram account in the Life app first.",
        },
        { status: 404, headers }
      );
    }

    // Get tracked products - include both user-specific and unassigned products
    const trackedProducts = await prisma.productTracking.findMany({
      where: {
        OR: [
          { userId: user.id }, // Products specifically tracked by this user
          { userId: null }, // Products tracked before user association (backward compatibility)
        ],
        isActive: true,
      },
      include: {
        product: true,
      },
    });

    if (trackedProducts.length === 0) {
      return NextResponse.json(
        {
          error: "No tracked products",
          message:
            "You need to track some products first before reporting lifecycle events.",
        },
        { status: 400, headers }
      );
    }

    // Process image if provided
    let productIdentification: ProductIdentificationResult | null = null;
    if (imageUrl || imageBase64) {
      try {
        productIdentification = await identifyProductFromImage(
          imageUrl || imageBase64!
        );
      } catch (error) {
        console.error("Image processing error:", error);
        // Continue without image analysis if it fails
      }
    }

    // Analyze text to determine lifecycle event
    const eventAnalysis = await analyzeLifecycleEvent(
      text || "",
      productIdentification
    );

    if (!eventAnalysis) {
      return NextResponse.json(
        {
          error: "Could not understand lifecycle event",
          message:
            "Please provide more details about what happened with your product.",
        },
        { status: 400, headers }
      );
    }

    // Find best matching product from user's tracked products using advanced matching
    const matchResult = await TelegramProductMatcher.findBestMatch(
      trackedProducts,
      productIdentification,
      text || ""
    );

    if (!matchResult) {
      return NextResponse.json(
        {
          error: "Could not match product",
          message: `I couldn't find a matching product in your tracking list. You're tracking: ${trackedProducts
            .map((tp) => tp.product.canonicalName)
            .join(", ")}`,
        },
        { status: 400, headers }
      );
    }

    const matchedProduct = matchResult.trackedProduct;

    // Create lifecycle step
    const lifecycleStep = await prisma.productLifecycleStep.create({
      data: {
        trackingId: matchedProduct.id,
        productId: matchedProduct.productId,
        userId: user.id,
        stepType: eventAnalysis.stepType,
        title: eventAnalysis.title,
        description: eventAnalysis.description,
        metadata: {
          source: "telegram_bot",
          telegramId,
          productIdentification,
          eventAnalysis,
          imageUrl: imageUrl || null,
          originalText: text,
          confidence: eventAnalysis.confidence,
          extractedInfo: eventAnalysis.extractedInfo,
          productMatch: {
            confidence: matchResult.confidence,
            reason: matchResult.matchReason,
            similarityScore: matchResult.similarityScore,
          },
        },
        sourceType: "telegram_bot",
        priority: getStepTypeInfo(eventAnalysis.stepType).priority,
      },
    });

    // Check if we should generate a summary after adding this step
    try {
      await LifecycleSummaryService.checkAndGenerateSummary(
        matchedProduct.productId,
        user.id
      );
    } catch (summaryError) {
      console.error('Error generating lifecycle summary:', summaryError);
      // Don't fail the main request if summary generation fails
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: `✅ Recorded "${eventAnalysis.title}" for ${matchedProduct.product.canonicalName}`,
        lifecycleStep: {
          id: lifecycleStep.id,
          stepType: lifecycleStep.stepType,
          title: lifecycleStep.title,
          description: lifecycleStep.description,
        },
        matchedProduct: {
          name: matchedProduct.product.canonicalName,
          ecoScore: matchedProduct.product.ecoScore,
        },
        matchInfo: {
          confidence: matchResult.confidence,
          reason: matchResult.matchReason,
          message:
            matchResult.confidence > 70
              ? "High confidence match"
              : matchResult.confidence > 40
              ? "Moderate confidence match"
              : "Low confidence match - please verify",
        },
      },
      { headers }
    );
  } catch (error) {
    console.error("Telegram event processing error:", error);

    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    return NextResponse.json(
      { error: "Failed to process lifecycle event. Please try again." },
      { status: 500, headers }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Computer vision function to identify products from images
async function identifyProductFromImage(
  imageData: string
): Promise<ProductIdentificationResult> {
  try {
    // Import OpenAI dynamically
    const { default: OpenAI } = await import("openai");

    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "OpenAI API key not configured, using fallback identification"
      );
      return {
        productName: "Unknown Product",
        category: "Unknown",
        confidence: 30,
        description: "Product identification requires OpenAI API key",
        condition: "unknown",
        brand: "unknown",
      };
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Analyze this product image and provide detailed information. Return ONLY a valid JSON object with these exact fields:
{
  "productName": "specific product name",
  "category": "product category (Electronics, Clothing, Home, Beauty, Sports, Food, etc.)",
  "confidence": 85,
  "description": "detailed description of the product",
  "condition": "apparent condition (new, used, worn, damaged, broken, excellent, etc.)",
  "brand": "brand name if visible or 'unknown'"
}

Focus on:
- Identifying the specific product type and name
- Determining the apparent condition from visual cues
- Assigning appropriate category
- Providing confidence based on image clarity and product visibility`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: imageData,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.3, // Lower temperature for more consistent results
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI Vision API");
    }

    // Try to parse JSON response
    try {
      // Clean the response to extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const result = JSON.parse(jsonMatch[0]);

      // Validate required fields
      const requiredFields = [
        "productName",
        "category",
        "confidence",
        "description",
      ];
      for (const field of requiredFields) {
        if (!result[field]) {
          result[field] = "unknown";
        }
      }

      // Ensure confidence is a number between 0-100
      if (
        typeof result.confidence !== "number" ||
        result.confidence < 0 ||
        result.confidence > 100
      ) {
        result.confidence = 70; // Default confidence
      }

      return {
        productName: result.productName || "Unknown Product",
        category: result.category || "Unknown",
        confidence: result.confidence,
        description: result.description || "Product identified from image",
        condition: result.condition || "unknown",
        brand: result.brand || "unknown",
      };
    } catch (parseError) {
      console.error("Failed to parse OpenAI response as JSON:", parseError);
      console.log("Raw response:", content);

      // Fallback: extract basic info from text response
      return {
        productName: extractProductName(content) || "Unknown Product",
        category: extractCategory(content) || "Unknown",
        confidence: 60,
        description: content.substring(0, 200) + "...",
        condition: extractCondition(content) || "unknown",
        brand: "unknown",
      };
    }
  } catch (error) {
    console.error("Vision API error:", error);

    // Return fallback response instead of throwing
    return {
      productName: "Unknown Product",
      category: "Unknown",
      confidence: 25,
      description:
        "Failed to analyze image - please provide more details in text",
      condition: "unknown",
      brand: "unknown",
    };
  }
}

// Helper function to extract product name from text response
function extractProductName(text: string): string | null {
  const productPatterns = [
    /product(?:\s+name)?[:\s]+([^,\n.]+)/i,
    /(?:this|the|a)\s+([^,\n.]+(?:phone|laptop|computer|device|camera|watch|headphones|speaker|tablet|tv|monitor|keyboard|mouse|printer|router))/i,
    /([^,\n.]+(?:phone|laptop|computer|device|camera|watch|headphones|speaker|tablet|tv|monitor|keyboard|mouse|printer|router))/i,
  ];

  for (const pattern of productPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

// Helper function to extract category from text response
function extractCategory(text: string): string | null {
  const categoryPatterns = [
    /category[:\s]+([^,\n.]+)/i,
    /(?:electronics|clothing|home|beauty|sports|food|automotive|books|toys|health)/i,
  ];

  for (const pattern of categoryPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  return null;
}

// Helper function to extract condition from text response
function extractCondition(text: string): string | null {
  const conditionPatterns = [
    /condition[:\s]+([^,\n.]+)/i,
    /(?:new|used|worn|damaged|broken|excellent|good|fair|poor)/i,
  ];

  for (const pattern of conditionPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim().toLowerCase();
    }
  }

  return null;
}

// Natural language processing to determine lifecycle event type
async function analyzeLifecycleEvent(
  text: string,
  productIdentification: ProductIdentificationResult | null
): Promise<LifecycleEventAnalysis | null> {
  if (!text || text.trim().length < 3) {
    return null;
  }

  const textLower = text.toLowerCase();

  // Simple keyword-based analysis (can be enhanced with OpenAI API later)
  const eventPatterns: Record<
    string,
    { keywords: string[]; stepType: LifecycleStepType }
  > = {
    malfunction: {
      keywords: [
        "broken",
        "not working",
        "stopped working",
        "malfunction",
        "dead",
        "failed",
        "error",
      ],
      stepType: "malfunction",
    },
    repair: {
      keywords: ["repaired", "fixed", "repair", "working again", "serviced"],
      stepType: "repair",
    },
    purchased: {
      keywords: ["bought", "purchased", "got", "acquired", "new"],
      stepType: "purchased",
    },
    disposed: {
      keywords: ["threw away", "disposed", "garbage", "trash", "discarded"],
      stepType: "disposed",
    },
    recycled: {
      keywords: ["recycled", "recycling", "recycle"],
      stepType: "recycled",
    },
    sold: {
      keywords: ["sold", "selling", "sold it"],
      stepType: "sold",
    },
    gifted: {
      keywords: ["gave away", "gifted", "donated", "gave to"],
      stepType: "gifted",
    },
    upgrade: {
      keywords: ["upgraded", "improved", "enhanced", "modified"],
      stepType: "upgrade",
    },
    maintenance: {
      keywords: ["cleaned", "maintained", "serviced", "cleaned up"],
      stepType: "maintenance",
    },
    working_well: {
      keywords: [
        "working well",
        "working great",
        "no issues",
        "perfect",
        "excellent",
      ],
      stepType: "working_well",
    },
    performance_issue: {
      keywords: ["slow", "sluggish", "performance issue", "not performing"],
      stepType: "performance_issue",
    },
  };

  // Find matching pattern
  for (const [eventType, pattern] of Object.entries(eventPatterns)) {
    for (const keyword of pattern.keywords) {
      if (textLower.includes(keyword)) {
        const stepInfo = getStepTypeInfo(pattern.stepType);
        return {
          stepType: pattern.stepType,
          title: `${stepInfo.label} - ${
            productIdentification?.productName || "Product"
          }`,
          description: text,
          confidence: 85, // Base confidence for keyword matching
          extractedInfo: {
            condition: productIdentification?.condition,
          },
        };
      }
    }
  }

  // Default to generic lifecycle event if no specific pattern matches
  return {
    stepType: "working_well",
    title: `Update - ${productIdentification?.productName || "Product"}`,
    description: text,
    confidence: 50,
    extractedInfo: {},
  };
}
