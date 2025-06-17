import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { lookupOrCreateProduct } from '@/lib/product-catalog';
import { prisma } from '@/lib/prisma';
import { LifecycleSummaryService } from '@/lib/lifecycle-summary';
import { getAuthenticatedUserId } from '@/lib/auth-utils';

// Request validation schema
const trackSchema = z.object({
  content: z.object({
    url: z.string(),
    title: z.string(),
    text: z.string(),
    images: z.array(z.any()).optional(), // Accept any format for images
    metadata: z.record(z.any()).optional(),
  }),
  userId: z.string().optional(), // Optional for now, can track without login
  trackingName: z.string().optional(),
  notes: z.string().optional(),
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
    const validationResult = trackSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Track API validation error:', validationResult.error.issues);
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400, headers }
      );
    }

    const { content, userId, trackingName, notes } = validationResult.data;

    // Get authenticated user from session, fallback to provided userId
    const authenticatedUserId = (await getAuthenticatedUserId()) || userId;

    console.log('Track API Debug:');
    console.log('- getAuthenticatedUserId() result:', await getAuthenticatedUserId());
    console.log('- provided userId parameter:', userId);
    console.log('- final authenticatedUserId:', authenticatedUserId);
    console.log('- will use userId in DB:', authenticatedUserId || null);

    // Check if we have sufficient content to analyze
    if (!content.text || content.text.trim().length < 10) {
      return NextResponse.json(
        { error: 'Insufficient content to track. Please make sure you\'re on a product page.' },
        { status: 400, headers }
      );
    }

    console.log('Tracking product from:', content.url);

    // First, ensure the product exists in our catalog
    // We'll use existing analysis or create new one
    let product;
    let analysisResult;
    let selectedImageUrl = null;

    try {
      // Try to find existing product first by analyzing content
      const analysisResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3080'}/api/products/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content,
          timestamp: Date.now()
        })
      });

      if (analysisResponse.ok) {
        analysisResult = await analysisResponse.json();
        
        // Find the product by its catalog data
        if (analysisResult.catalogData?.productId) {
          product = await prisma.product.findUnique({
            where: { id: analysisResult.catalogData.productId }
          });
        }
      }
    } catch (error) {
      console.error('Error getting product analysis:', error);
    }

    // Select best product image if images are available
    console.log('Checking for images to select...', {
      hasImages: !!content.images,
      imageCount: content.images?.length || 0,
      hasAnalysisResult: !!analysisResult,
      hasCanonicalData: !!analysisResult?.canonicalData,
      analysisResultKeys: analysisResult ? Object.keys(analysisResult) : []
    });
    
    if (content.images && content.images.length > 0 && analysisResult) {
      try {
        // Filter for image objects (not legacy string format)
        const imageObjects = content.images.filter(img => typeof img === 'object' && img.url);
        console.log('Found image objects:', imageObjects.length);
        
        if (imageObjects.length > 0) {
          console.log('Calling image selection API...');
          const imageSelectionResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3080'}/api/products/select-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              images: imageObjects,
              productName: analysisResult.productName || content.title,
              productDescription: analysisResult.insights?.join('. ') || content.title
            })
          });

          console.log('Image selection response status:', imageSelectionResponse.status);
          if (imageSelectionResponse.ok) {
            const imageResult = await imageSelectionResponse.json();
            console.log('Image selection result:', imageResult);
            if (imageResult.success && imageResult.selectedImageUrl) {
              selectedImageUrl = imageResult.selectedImageUrl;
              console.log('Selected product image:', selectedImageUrl);
            }
          } else {
            console.error('Image selection API failed:', await imageSelectionResponse.text());
          }
        }
      } catch (error) {
        console.error('Error selecting product image:', error);
      }
    }

    if (!product) {
      return NextResponse.json(
        { error: 'Could not analyze product for tracking. Please try again.' },
        { status: 500, headers }
      );
    }

    // Update product image if we selected one and product doesn't have one yet
    if (selectedImageUrl && !product.primaryImageUrl) {
      await prisma.product.update({
        where: { id: product.id },
        data: { primaryImageUrl: selectedImageUrl }
      });
    }

    // Check if user is already tracking this product
    let tracking = await prisma.productTracking.findFirst({
      where: {
        productId: product.id,
        userId: authenticatedUserId || null,
        isActive: true,
      },
      include: {
        product: {
          select: {
            id: true,
            canonicalName: true,
            ecoScore: true,
            category: true,
          }
        }
      }
    });

    let isNew = false;
    if (!tracking) {
      // Create new tracking record only if not already tracking
      tracking = await prisma.productTracking.create({
        data: {
          productId: product.id,
          userId: authenticatedUserId || null, // Allow null for anonymous tracking
          sourceUrl: content.url,
          trackingName: trackingName,
          notes: notes,
          priceAlerts: false,
          stockAlerts: false,
          sustainabilityAlerts: true, // Default to sustainability alerts
          isActive: true,
        },
        include: {
          product: {
            select: {
              id: true,
              canonicalName: true,
              ecoScore: true,
              category: true,
            }
          }
        }
      });
      isNew = true;
    } else {
      // Update existing tracking with new information if provided
      if (trackingName || notes) {
        tracking = await prisma.productTracking.update({
          where: { id: tracking.id },
          data: {
            ...(trackingName && { trackingName }),
            ...(notes && { notes }),
            updatedAt: new Date(),
          },
          include: {
            product: {
              select: {
                id: true,
                canonicalName: true,
                ecoScore: true,
                category: true,
              }
            }
          }
        });
      }
    }

    // Create initial lifecycle step only for new tracking
    if (isNew) {
      await prisma.productLifecycleStep.create({
        data: {
          trackingId: tracking.id,
          productId: product.id,
          userId: authenticatedUserId || null, // Allow null for anonymous tracking
          stepType: 'tracked',
          title: 'Product Added to Tracking',
          description: `Started tracking "${product.canonicalName}" for sustainability monitoring`,
          metadata: {
            source: 'track_api',
            initialEcoScore: product.ecoScore,
            trackingMethod: 'manual',
          },
          ecoScoreBefore: null,
          ecoScoreAfter: product.ecoScore,
          sourceUrl: content.url,
          sourceType: 'api',
          priority: 8,
        }
      });
    }

    // Check if we should generate a summary after adding this step (only for new tracking)
    if (isNew) {
      try {
        await LifecycleSummaryService.checkAndGenerateSummary(
          product.id,
          authenticatedUserId || undefined
        );
      } catch (summaryError) {
        console.error('Error generating lifecycle summary:', summaryError);
        // Don't fail the main request if summary generation fails
      }
    }

    return NextResponse.json({
      success: true,
      productName: product.canonicalName,
      productId: product.id,
      trackingId: tracking.id,
      message: isNew ? 'Product added to tracking list successfully' : 'Product already being tracked',
      isNew: isNew,
    }, { headers });

  } catch (error) {
    console.error('Tracking error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return NextResponse.json(
      { error: 'Failed to track product. Please try again.' },
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