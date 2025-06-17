import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateProductEmbeddings, findSimilarProducts } from '@/lib/embedding-service';
import { prisma } from '@/lib/prisma';

// Request validation schema
const recommendSchema = z.object({
  content: z.object({
    url: z.string(),
    title: z.string(),
    text: z.string(),
    images: z.array(
      z.union([
        z.string(), // Legacy format: just URLs
        z.object({  // New format: image metadata objects
          url: z.string(),
          alt: z.string().optional(),
          title: z.string().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
          className: z.string().optional(),
          parentClass: z.string().optional(),
          parentId: z.string().optional(),
          area: z.number().optional(),
          aspectRatio: z.number().optional(),
          visible: z.boolean().optional(),
        })
      ])
    ).optional(),
    metadata: z.object({}).optional(),
  }),
  currentProductId: z.string().optional(), // If we already know the product ID
  minEcoScore: z.number().min(0).max(100).default(60), // Minimum eco score for recommendations
  limit: z.number().min(1).max(10).default(5), // Number of recommendations
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
    const validationResult = recommendSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400, headers }
      );
    }

    const { content, currentProductId, minEcoScore, limit } = validationResult.data;

    console.log('Finding recommendations for:', content.url);

    let currentProduct = null;
    let currentEcoScore = 0;
    let searchEmbeddings = null;

    // If we have a current product ID, get its details
    if (currentProductId) {
      currentProduct = await prisma.product.findUnique({
        where: { id: currentProductId },
        select: {
          id: true,
          canonicalName: true,
          ecoScore: true,
          category: true,
          nameEmbedding: true,
          descriptionEmbedding: true,
        }
      });

      if (currentProduct) {
        currentEcoScore = currentProduct.ecoScore || 0;
        
        // Use existing embeddings if available
        if (currentProduct.nameEmbedding && currentProduct.descriptionEmbedding) {
          searchEmbeddings = {
            nameEmbedding: JSON.parse(currentProduct.nameEmbedding),
            descriptionEmbedding: JSON.parse(currentProduct.descriptionEmbedding),
          };
        }
      }
    }

    // If we don't have embeddings, extract product name and generate them
    if (!searchEmbeddings) {
      const productName = extractProductName(content.title, content.text);
      const productDescription = content.text.substring(0, 1000);
      
      try {
        searchEmbeddings = await generateProductEmbeddings(productName, productDescription);
      } catch (error) {
        console.error('Error generating embeddings for recommendations:', error);
        return NextResponse.json(
          { error: 'Could not generate recommendations. Please try again.' },
          { status: 500, headers }
        );
      }
    }

    // Find similar products with better eco scores
    const similarProducts = await findSimilarProducts(
      searchEmbeddings.nameEmbedding,
      searchEmbeddings.descriptionEmbedding,
      0.7 // Lower threshold for broader recommendations
    );

    // Filter for better eco-friendly alternatives
    const recommendations = await Promise.all(
      similarProducts
        .filter(product => product.productId !== currentProductId) // Exclude current product
        .slice(0, limit * 2) // Get more candidates to filter from
        .map(async (similar) => {
          const product = await prisma.product.findUnique({
            where: { id: similar.productId },
            select: {
              id: true,
              canonicalName: true,
              canonicalDescription: true,
              ecoScore: true,
              category: true,
              materials: true,
              certifications: true,
              scanCount: true,
              confidence: true,
              lifecycleInsights: true,
            }
          });

          if (!product || !product.ecoScore) return null;

          // Only recommend products with better eco scores
          if (product.ecoScore > Math.max(currentEcoScore, minEcoScore)) {
            // Get latest insights from lifecycle data
            const lifecycle = product.lifecycleInsights as any;
            const latestAnalysis = lifecycle?.analysisHistory?.[lifecycle.analysisHistory.length - 1];
            
            // Get source URLs from lifecycle data
            const sources = lifecycle?.sources || [];
            const primaryUrl = sources[0] || null;
            
            return {
              id: product.id,
              name: product.canonicalName,
              description: product.canonicalDescription.substring(0, 200) + '...',
              ecoScore: product.ecoScore,
              category: product.category,
              materials: product.materials,
              certifications: product.certifications,
              scanCount: product.scanCount,
              confidence: product.confidence,
              similarity: similar.similarity,
              improvementScore: product.ecoScore - currentEcoScore,
              insights: latestAnalysis?.insights?.slice(0, 2) || [],
              reasoning: latestAnalysis?.reasoning || '',
              sourceUrl: primaryUrl,
              allSources: sources.slice(0, 3), // Include up to 3 source URLs
            };
          }

          return null;
        })
    );

    // Filter out nulls and sort by improvement score and similarity
    const validRecommendations = recommendations
      .filter(rec => rec !== null)
      .sort((a, b) => {
        // Primary sort: improvement in eco score
        const improvementDiff = b.improvementScore - a.improvementScore;
        if (Math.abs(improvementDiff) > 5) return improvementDiff;
        
        // Secondary sort: similarity
        return b.similarity - a.similarity;
      })
      .slice(0, limit);

    // If no recommendations found, try to find products in the same category with better scores
    if (validRecommendations.length === 0) {
      const categoryRecommendations = await findCategoryRecommendations(
        currentProduct?.category || extractCategory(content.text),
        currentEcoScore,
        minEcoScore,
        limit
      );
      
      return NextResponse.json({
        success: true,
        recommendations: categoryRecommendations,
        currentProduct: currentProduct ? {
          name: currentProduct.canonicalName,
          ecoScore: currentEcoScore,
        } : null,
        message: categoryRecommendations.length > 0 
          ? `Found ${categoryRecommendations.length} better alternatives in the same category`
          : 'No better eco-friendly alternatives found in our database',
        type: 'category',
      }, { headers });
    }

    return NextResponse.json({
      success: true,
      recommendations: validRecommendations,
      currentProduct: currentProduct ? {
        name: currentProduct.canonicalName,
        ecoScore: currentEcoScore,
      } : null,
      message: `Found ${validRecommendations.length} better eco-friendly alternatives`,
      type: 'similarity',
    }, { headers });

  } catch (error) {
    console.error('Recommendation error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return NextResponse.json(
      { error: 'Failed to generate recommendations. Please try again.' },
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

// Helper function to extract product name from content
function extractProductName(title: string, text: string): string {
  // Try to extract product name from title first
  const cleanTitle = title.replace(/[|•-].*/g, '').trim();
  if (cleanTitle.length > 3 && cleanTitle.length < 100) {
    return cleanTitle;
  }
  
  // Fallback to first meaningful line from text
  const lines = text.split('\n').filter(line => line.trim().length > 3);
  return lines[0]?.substring(0, 100) || 'Product';
}

// Helper function to extract category from content
function extractCategory(text: string): string | null {
  const categories = [
    'clothing', 'electronics', 'food', 'beauty', 'home', 'furniture',
    'shoes', 'accessories', 'books', 'toys', 'sports', 'health'
  ];
  
  const lowerText = text.toLowerCase();
  return categories.find(cat => lowerText.includes(cat)) || null;
}

// Helper function to find recommendations by category
async function findCategoryRecommendations(
  category: string | null,
  currentEcoScore: number,
  minEcoScore: number,
  limit: number
) {
  if (!category) return [];
  
  const products = await prisma.product.findMany({
    where: {
      category: {
        contains: category,
        mode: 'insensitive',
      },
      ecoScore: {
        gt: Math.max(currentEcoScore, minEcoScore),
      },
    },
    select: {
      id: true,
      canonicalName: true,
      canonicalDescription: true,
      ecoScore: true,
      category: true,
      materials: true,
      certifications: true,
      scanCount: true,
      confidence: true,
      lifecycleInsights: true,
    },
    orderBy: {
      ecoScore: 'desc',
    },
    take: limit,
  });

  return products.map(product => {
    const lifecycle = product.lifecycleInsights as any;
    const latestAnalysis = lifecycle?.analysisHistory?.[lifecycle.analysisHistory.length - 1];
    
    // Get source URLs from lifecycle data
    const sources = lifecycle?.sources || [];
    const primaryUrl = sources[0] || null;
    
    return {
      id: product.id,
      name: product.canonicalName,
      description: product.canonicalDescription.substring(0, 200) + '...',
      ecoScore: product.ecoScore,
      category: product.category,
      materials: product.materials,
      certifications: product.certifications,
      scanCount: product.scanCount,
      confidence: product.confidence,
      similarity: 0.8, // Default similarity for category matches
      improvementScore: product.ecoScore! - currentEcoScore,
      insights: latestAnalysis?.insights?.slice(0, 2) || [],
      reasoning: latestAnalysis?.reasoning || '',
      sourceUrl: primaryUrl,
      allSources: sources.slice(0, 3), // Include up to 3 source URLs
    };
  });
}