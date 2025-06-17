import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// Request validation schema
const myProductsSchema = z.object({
  userId: z.string().optional(), // Optional for now, will be required when auth is implemented
  includeInactive: z.boolean().default(false),
  sortBy: z.enum(['name', 'ecoScore', 'dateAdded', 'lastUpdate']).default('dateAdded'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export async function GET(request: NextRequest) {
  try {
    // Add CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Parse query parameters
    const url = new URL(request.url);
    const params = {
      userId: url.searchParams.get('userId') || undefined,
      includeInactive: url.searchParams.get('includeInactive') === 'true',
      sortBy: url.searchParams.get('sortBy') as any || 'dateAdded',
      sortOrder: url.searchParams.get('sortOrder') as any || 'desc',
      limit: parseInt(url.searchParams.get('limit') || '50'),
      offset: parseInt(url.searchParams.get('offset') || '0'),
    };

    // Validate parameters
    const validationResult = myProductsSchema.safeParse(params);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validationResult.error.issues },
        { status: 400, headers }
      );
    }

    const { userId, includeInactive, sortBy, sortOrder, limit, offset } = validationResult.data;

    // Get authenticated user from session
    let authenticatedUserId = userId;
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

    // Require authentication for my-products endpoint
    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: 'Authentication required to view your products' },
        { status: 401, headers }
      );
    }

    // Build where clause - only show current user's products
    const whereClause: any = {
      isActive: includeInactive ? undefined : true,
      userId: authenticatedUserId, // Always filter by authenticated user
    };

    // Build order by clause
    let orderBy: any = {};
    switch (sortBy) {
      case 'name':
        orderBy = { product: { canonicalName: sortOrder } };
        break;
      case 'ecoScore':
        orderBy = { product: { ecoScore: sortOrder } };
        break;
      case 'dateAdded':
        orderBy = { createdAt: sortOrder };
        break;
      case 'lastUpdate':
        orderBy = { updatedAt: sortOrder };
        break;
    }

    console.log('Fetching tracked products with filters:', { whereClause, orderBy, limit, offset });

    // Fetch tracked products with full details
    const trackedProducts = await prisma.productTracking.findMany({
      where: whereClause,
      include: {
        product: {
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
            firstDiscovered: true,
            lifecycleInsights: true,
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        lifecycleSteps: {
          where: {
            isVisible: true,
            OR: [
              { sourceType: 'telegram_bot' },
              { sourceType: 'manual' },
              { 
                AND: [
                  { sourceType: 'api' },
                  { stepType: 'tracked' }
                ]
              }
            ]
          },
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' }
          ],
          select: {
            id: true,
            stepType: true,
            title: true,
            description: true,
            metadata: true,
            ecoScoreBefore: true,
            ecoScoreAfter: true,
            priceBefore: true,
            priceAfter: true,
            sourceUrl: true,
            sourceType: true,
            priority: true,
            createdAt: true,
          }
        }
      },
      orderBy,
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const totalCount = await prisma.productTracking.count({
      where: whereClause,
    });

    // Transform the data for frontend consumption
    const formattedProducts = trackedProducts.map(tracking => {
      const product = tracking.product;
      const lifecycle = product.lifecycleInsights as any;
      
      return {
        trackingId: tracking.id,
        productId: product.id,
        name: product.canonicalName,
        description: product.canonicalDescription,
        ecoScore: product.ecoScore,
        category: product.category,
        materials: product.materials,
        certifications: product.certifications,
        scanCount: product.scanCount,
        confidence: product.confidence,
        imageUrl: product.primaryImageUrl,
        
        // Tracking specific data
        trackingName: tracking.trackingName,
        notes: tracking.notes,
        sourceUrl: tracking.sourceUrl,
        dateAdded: tracking.createdAt,
        lastUpdate: tracking.updatedAt,
        
        // Alert preferences
        alerts: {
          price: tracking.priceAlerts,
          stock: tracking.stockAlerts,
          sustainability: tracking.sustainabilityAlerts,
        },
        
        // Lifecycle data
        lifecycleSteps: tracking.lifecycleSteps,
        lifecycleSummary: {
          totalSteps: tracking.lifecycleSteps.length,
          lastActivity: tracking.lifecycleSteps[0]?.createdAt || tracking.createdAt,
          majorEvents: tracking.lifecycleSteps.filter(step => step.priority >= 8).length,
          improvements: tracking.lifecycleSteps.filter(step => 
            step.ecoScoreAfter && step.ecoScoreBefore && 
            step.ecoScoreAfter > step.ecoScoreBefore
          ).length,
        },
        
        // Product insights from global catalog
        globalInsights: {
          sources: lifecycle?.sources || [],
          scanCount: product.scanCount,
          firstDiscovered: product.firstDiscovered,
          confidence: product.confidence,
        }
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedProducts,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalCount / limit),
      },
      filters: {
        userId,
        includeInactive,
        sortBy,
        sortOrder,
      },
      message: `Found ${formattedProducts.length} tracked products`,
    }, { headers });

  } catch (error) {
    console.error('My products fetch error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return NextResponse.json(
      { error: 'Failed to fetch tracked products. Please try again.' },
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