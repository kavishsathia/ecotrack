import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// Request validation schema
const discoverSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  minEcoScore: z.number().min(0).max(100).optional(),
  maxEcoScore: z.number().min(0).max(100).optional(),
  sortBy: z.enum(['name', 'ecoScore', 'scanCount', 'dateAdded']).default('scanCount'),
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
      search: url.searchParams.get('search') || undefined,
      category: url.searchParams.get('category') || undefined,
      minEcoScore: url.searchParams.get('minEcoScore') ? parseInt(url.searchParams.get('minEcoScore')!) : undefined,
      maxEcoScore: url.searchParams.get('maxEcoScore') ? parseInt(url.searchParams.get('maxEcoScore')!) : undefined,
      sortBy: url.searchParams.get('sortBy') as any || 'scanCount',
      sortOrder: url.searchParams.get('sortOrder') as any || 'desc',
      limit: parseInt(url.searchParams.get('limit') || '50'),
      offset: parseInt(url.searchParams.get('offset') || '0'),
    };

    // Validate parameters
    const validationResult = discoverSchema.safeParse(params);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validationResult.error.issues },
        { status: 400, headers }
      );
    }

    const { search, category, minEcoScore, maxEcoScore, sortBy, sortOrder, limit, offset } = validationResult.data;

    // Build where clause
    const whereClause: any = {};

    // Search filter
    if (search) {
      whereClause.OR = [
        { canonicalName: { contains: search, mode: 'insensitive' } },
        { canonicalDescription: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { materials: { hasSome: [search] } },
        { certifications: { hasSome: [search] } },
      ];
    }

    // Category filter
    if (category) {
      whereClause.category = { contains: category, mode: 'insensitive' };
    }

    // Eco score range filter
    if (minEcoScore !== undefined || maxEcoScore !== undefined) {
      whereClause.ecoScore = {};
      if (minEcoScore !== undefined) {
        whereClause.ecoScore.gte = minEcoScore;
      }
      if (maxEcoScore !== undefined) {
        whereClause.ecoScore.lte = maxEcoScore;
      }
    }

    // Build order by clause
    let orderBy: any = {};
    switch (sortBy) {
      case 'name':
        orderBy = { canonicalName: sortOrder };
        break;
      case 'ecoScore':
        orderBy = { ecoScore: sortOrder };
        break;
      case 'scanCount':
        orderBy = { scanCount: sortOrder };
        break;
      case 'dateAdded':
        orderBy = { firstDiscovered: sortOrder };
        break;
    }

    console.log('Fetching products for discovery with filters:', { whereClause, orderBy, limit, offset });

    // Fetch products from the global catalog
    const products = await prisma.product.findMany({
      where: whereClause,
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
        firstDiscovered: true,
        lifecycleInsights: true,
        tracking: {
          select: {
            id: true,
            trackingName: true,
            user: {
              select: {
                name: true,
              }
            },
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 5, // Show recent trackings
        },
      },
      orderBy,
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const totalCount = await prisma.product.count({
      where: whereClause,
    });

    // Get categories for filtering
    const categories = await prisma.product.findMany({
      where: {
        category: { not: null }
      },
      select: {
        category: true,
      },
      distinct: ['category'],
    });

    // Transform the data for frontend consumption
    const formattedProducts = products.map(product => {
      const lifecycle = product.lifecycleInsights as any;
      
      return {
        id: product.id,
        name: product.canonicalName,
        description: product.canonicalDescription,
        ecoScore: product.ecoScore,
        category: product.category,
        materials: product.materials,
        certifications: product.certifications,
        scanCount: product.scanCount,
        confidence: product.confidence,
        dateAdded: product.firstDiscovered,
        
        // Global insights
        globalInsights: {
          sources: lifecycle?.sources || [],
          scanCount: product.scanCount,
          firstDiscovered: product.firstDiscovered,
          confidence: product.confidence,
        },
        
        // Recent trackings by users
        recentTrackings: product.tracking.map(tracking => ({
          id: tracking.id,
          name: tracking.trackingName,
          userName: tracking.user?.name || 'Anonymous',
          dateAdded: tracking.createdAt,
        })),
        
        // Summary stats
        trackingStats: {
          totalTrackings: product.tracking.length,
          recentTrackings: product.tracking.length,
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
        search,
        category,
        minEcoScore,
        maxEcoScore,
        sortBy,
        sortOrder,
      },
      categories: categories.map(c => c.category).filter(Boolean),
      message: `Found ${formattedProducts.length} products`,
    }, { headers });

  } catch (error) {
    console.error('Discover products fetch error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return NextResponse.json(
      { error: 'Failed to fetch products. Please try again.' },
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