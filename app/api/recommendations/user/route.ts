import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { findSimilarProducts } from '@/lib/embedding-service';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// Request validation schema
const userRecommendationsSchema = z.object({
  limit: z.number().min(1).max(20).default(10),
  minEcoScoreImprovement: z.number().min(0).max(50).default(10), // Minimum eco score improvement
  categories: z.array(z.string()).optional(), // Filter by categories
});

export async function GET(request: NextRequest) {
  try {
    // Add CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Get authenticated user from session
    let authenticatedUserId: string | null = null;
    try {
      const cookieStore = await cookies();
      const userSession = cookieStore.get('user_session');
      
      if (userSession) {
        authenticatedUserId = userSession.value;
        console.log('Found authenticated user ID from session:', authenticatedUserId);
      }
    } catch (error) {
      console.log('Session lookup error:', error);
    }

    // Require authentication
    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: 'Authentication required to get personalized recommendations' },
        { status: 401, headers }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const params = {
      limit: parseInt(url.searchParams.get('limit') || '10'),
      minEcoScoreImprovement: parseInt(url.searchParams.get('minEcoScoreImprovement') || '10'),
      categories: url.searchParams.get('categories')?.split(',').filter(Boolean) || undefined,
    };

    // Validate parameters
    const validationResult = userRecommendationsSchema.safeParse(params);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validationResult.error.issues },
        { status: 400, headers }
      );
    }

    const { limit, minEcoScoreImprovement, categories } = validationResult.data;

    console.log('Getting user recommendations with params:', { limit, minEcoScoreImprovement, categories });

    // Get user's tracked products
    const trackedProducts = await prisma.productTracking.findMany({
      where: {
        userId: authenticatedUserId,
        isActive: true,
      },
      include: {
        product: {
          select: {
            id: true,
            canonicalName: true,
            ecoScore: true,
            category: true,
            nameEmbedding: true,
            descriptionEmbedding: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5, // Use recent products for recommendations
    });

    if (trackedProducts.length === 0) {
      return NextResponse.json({
        success: true,
        recommendations: [],
        message: 'Track some products first to get personalized recommendations',
        userTrackedCount: 0,
      }, { headers });
    }


    const allRecommendations: any[] = [];

    // Generate recommendations for each tracked product
    for (const tracking of trackedProducts) {
      const currentProduct = tracking.product;
      const currentEcoScore = currentProduct.ecoScore || 0;
      
      // Skip if product doesn't have embeddings
      if (!currentProduct.nameEmbedding || !currentProduct.descriptionEmbedding) {
        continue;
      }

      try {
        const nameEmbedding = JSON.parse(currentProduct.nameEmbedding);
        const descriptionEmbedding = JSON.parse(currentProduct.descriptionEmbedding);

        // Find similar products
        const similarProducts = await findSimilarProducts(
          nameEmbedding,
          descriptionEmbedding,
          0.3 // Lower similarity threshold for more results
        );


        // Process recommendations for this product
        for (const similar of similarProducts.slice(0, limit)) {
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
              primaryImageUrl: true,
              lifecycleInsights: true,
            }
          });

          if (!product || !product.ecoScore) continue;

          // Only recommend if eco score improvement meets threshold
          const improvement = product.ecoScore - currentEcoScore;
          if (improvement < minEcoScoreImprovement) continue;

          // Filter by categories if specified
          if (categories && categories.length > 0 && !categories.includes(product.category)) {
            continue;
          }

          // Avoid recommending products the user already tracks
          const alreadyTracked = trackedProducts.some(tp => tp.product.id === product.id);
          if (alreadyTracked) continue;

          // Get source URLs from lifecycle data
          const lifecycle = product.lifecycleInsights as any;
          const sources = lifecycle?.sources || [];
          const primaryUrl = sources[0] || null;

          // Use product image or generate placeholder
          const imageUrl = product.primaryImageUrl || `https://images.unsplash.com/photo-${Math.random().toString().substring(2, 15)}?w=400&h=${300 + Math.floor(Math.random() * 200)}&fit=crop`;

          allRecommendations.push({
            id: product.id,
            name: product.canonicalName,
            description: product.canonicalDescription?.substring(0, 150) + '...' || 'Sustainable alternative product',
            ecoScore: product.ecoScore,
            category: product.category,
            materials: product.materials || [],
            certifications: product.certifications || [],
            imageUrl,
            sourceUrl: primaryUrl,
            confidence: Math.min(95, 70 + similar.similarity * 30), // Scale similarity to confidence
            improvementScore: improvement,
            reasonForRecommendation: `Better alternative to your tracked ${currentProduct.canonicalName}`,
            sustainabilityHighlights: [
              improvement >= 30 ? 'Significantly more sustainable' : 'More sustainable option',
              product.materials?.length ? `Made with ${product.materials.slice(0, 2).join(', ')}` : 'Eco-friendly materials',
              product.certifications?.length ? `${product.certifications[0]} certified` : 'Environmentally conscious',
            ].filter(Boolean),
            basedOnProduct: {
              id: currentProduct.id,
              name: currentProduct.canonicalName,
              ecoScore: currentEcoScore,
            },
            cardHeight: ['small', 'medium', 'large'][Math.floor(Math.random() * 3)] as 'small' | 'medium' | 'large',
          });
        }
      } catch (error) {
        console.error(`Error processing recommendations for product ${currentProduct.id}:`, error);
        continue;
      }
    }

    // Remove duplicates and sort by improvement score
    const uniqueRecommendations = allRecommendations
      .filter((rec, index, self) => 
        index === self.findIndex(r => r.id === rec.id)
      )
      .sort((a, b) => b.improvementScore - a.improvementScore)
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      recommendations: uniqueRecommendations,
      userTrackedCount: trackedProducts.length,
      message: uniqueRecommendations.length > 0 
        ? `Found ${uniqueRecommendations.length} sustainable alternatives` 
        : 'No better alternatives found for your tracked products',
    }, { headers });

  } catch (error) {
    console.error('User recommendations error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}