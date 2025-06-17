import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { lookupOrCreateProduct, ProductAnalysisResult } from '@/lib/product-catalog';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Request validation schema
const analyzeSchema = z.object({
  content: z.object({
    url: z.string(),
    title: z.string(),
    text: z.string(),
    images: z.array(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
  }),
  timestamp: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Add CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    const body = await request.json();
    
    // Validate input
    const validationResult = analyzeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400, headers }
      );
    }

    const { content } = validationResult.data;

    // Check if we have sufficient content to analyze
    if (!content.text || content.text.trim().length < 10) {
      return NextResponse.json(
        { error: 'Insufficient content to analyze. Please make sure you\'re on a product page.' },
        { status: 400, headers }
      );
    }

    // First, try to find existing product in catalog
    console.log('Starting product analysis and catalog lookup...');
    
    // Quick lookup for exact matches before AI analysis
    const quickResult = await quickCatalogLookup(content);
    if (quickResult) {
      console.log('Found existing product in catalog, returning cached result');
      return NextResponse.json({
        ...quickResult,
        fromCache: true,
        message: 'Retrieved from global product catalog',
      }, { headers });
    }

    // No existing product found, proceed with AI analysis
    console.log('No existing product found, running AI analysis...');
    const analysisPrompt = createAnalysisPrompt(content);
    
    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(analysisPrompt);
    const response = await result.response;
    const analysisText = response.text();

    // Parse the AI response
    const analysisResult = parseGeminiResponse(analysisText);
    
    // Store in global product catalog
    console.log('Storing analysis result in product catalog...');
    const catalogEntry = await lookupOrCreateProduct(content, analysisResult);
    
    // Prepare response with catalog metadata
    const responseData = {
      ...analysisResult,
      fromCache: false,
      catalogData: {
        productId: catalogEntry.product.id,
        isExisting: catalogEntry.isExisting,
        similarity: catalogEntry.similarity,
        scanCount: catalogEntry.product.scanCount,
        confidence: catalogEntry.product.confidence,
      },
      message: catalogEntry.isExisting 
        ? `Updated existing product (${catalogEntry.product.scanCount} total scans)`
        : 'Added new product to global catalog',
    };

    return NextResponse.json(responseData, { headers });

  } catch (error) {
    console.error('Analysis error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return NextResponse.json(
      { error: 'Failed to analyze product. Please try again.' },
      { status: 500, headers }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// Quick lookup for exact content matches
async function quickCatalogLookup(content: any) {
  try {
    const { generateContentHash } = await import('@/lib/embedding-service');
    const { prisma } = await import('@/lib/prisma');
    
    const contentHash = generateContentHash(content);
    
    const existingScan = await prisma.productScan.findUnique({
      where: { contentHash },
      include: {
        product: {
          select: {
            id: true,
            canonicalName: true,
            ecoScore: true,
            category: true,
            materials: true,
            certifications: true,
            lifecycleInsights: true,
            scanCount: true,
            confidence: true,
          },
        },
      },
    });
    
    if (existingScan && existingScan.product) {
      // Increment scan count
      await prisma.product.update({
        where: { id: existingScan.product.id },
        data: { scanCount: { increment: 1 } },
      });
      
      // Extract insights from lifecycle data
      const lifecycle = existingScan.product.lifecycleInsights as any;
      const latestAnalysis = lifecycle?.analysisHistory?.[lifecycle.analysisHistory.length - 1];
      
      return {
        productName: existingScan.product.canonicalName,
        ecoScore: existingScan.product.ecoScore || 0,
        category: existingScan.product.category || '',
        materials: existingScan.product.materials || [],
        certifications: existingScan.product.certifications || [],
        insights: latestAnalysis?.insights || ['Product previously analyzed'],
        reasoning: latestAnalysis?.reasoning || 'Retrieved from product catalog',
        catalogData: {
          productId: existingScan.product.id,
          scanCount: existingScan.product.scanCount + 1,
          confidence: existingScan.product.confidence,
        },
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error in quick catalog lookup:', error);
    return null;
  }
}

function createAnalysisPrompt(content: any): string {
  return `
You are an expert in sustainability and environmental impact assessment. Analyze the following product page content and provide a comprehensive eco-friendliness evaluation.

**Product Page Content:**
URL: ${content.url}
Title: ${content.title}
Text Content: ${content.text}
${content.images?.length ? `Image Alt Texts: ${content.images.join(', ')}` : ''}

**Your Task:**
Analyze this product for eco-friendliness and sustainability. Consider factors like:
- Materials used (organic, recycled, biodegradable, etc.)
- Manufacturing processes
- Packaging
- Durability and longevity
- End-of-life disposal
- Certifications (organic, fair trade, etc.)
- Carbon footprint
- Company sustainability practices

**Response Format (JSON only):**
{
  "productName": "Extract the product name",
  "ecoScore": 0-100,
  "category": "product category if identifiable",
  "materials": ["list of materials mentioned"],
  "certifications": ["any eco certifications found"],
  "insights": [
    "3-5 specific sustainability insights",
    "Focus on what makes it eco-friendly or not",
    "Mention specific materials, processes, or features"
  ],
  "reasoning": "Brief explanation of the score"
}

**Important:**
- Be realistic and evidence-based in your scoring
- If information is limited, score conservatively
- Only return valid JSON
- Score based on actual eco-friendly features mentioned, not assumptions
`;
}

function parseGeminiResponse(responseText: string) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const jsonStr = jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    // Validate and sanitize the response
    const result = {
      productName: parsed.productName || 'Unknown Product',
      ecoScore: Math.max(0, Math.min(100, parsed.ecoScore || 0)),
      category: parsed.category || '',
      materials: Array.isArray(parsed.materials) ? parsed.materials : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5) : [
        'Analysis completed but no specific insights available'
      ],
      reasoning: parsed.reasoning || 'Score based on available product information'
    };

    return result;
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    
    // Fallback response
    return {
      productName: 'Product Analysis',
      ecoScore: 50,
      category: 'Unknown',
      materials: [],
      certifications: [],
      insights: ['Unable to complete detailed analysis. Please try again with a clearer product page.'],
      reasoning: 'Analysis could not be completed due to parsing error'
    };
  }
}