import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCategoryForStepType } from '@/lib/lifecycle-types';

// Query parameters validation
const stepsQuerySchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
  productId: z.string().optional(),
  stepCategory: z.string().optional(),
  sourceType: z.string().optional(),
  dateRange: z.string().optional(),
  search: z.string().optional(),
  userId: z.string().optional(), // Optional user filtering
});

export async function GET(request: NextRequest) {
  try {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const validationResult = stepsQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validationResult.error.issues },
        { status: 400, headers }
      );
    }

    const { 
      limit, 
      offset, 
      productId, 
      stepCategory, 
      sourceType, 
      dateRange, 
      search, 
      userId 
    } = validationResult.data;

    // Build where clause
    const whereClause: any = {};

    // User filtering (if provided)
    if (userId) {
      whereClause.userId = userId;
    }

    // Product filtering
    if (productId) {
      whereClause.productId = productId;
    }

    // Source type filtering
    if (sourceType) {
      whereClause.sourceType = sourceType;
    }

    // Date range filtering
    if (dateRange) {
      const now = new Date();
      let startDate: Date;

      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
        default:
          startDate = new Date(0); // Beginning of time
      }

      whereClause.createdAt = {
        gte: startDate,
      };
    }

    // Text search
    if (search && search.trim().length > 0) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { 
          product: { 
            canonicalName: { contains: search, mode: 'insensitive' } 
          } 
        },
      ];
    }

    // Get total count
    const totalCount = await prisma.productLifecycleStep.count({
      where: whereClause,
    });

    // Get lifecycle steps
    let lifecycleSteps = await prisma.productLifecycleStep.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            canonicalName: true,
            ecoScore: true,
            category: true,
          },
        },
        tracking: {
          select: {
            id: true,
            trackingName: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            telegramUsername: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: Math.min(limit, 100), // Cap at 100 items per request
    });

    // Filter by step category if specified
    if (stepCategory) {
      lifecycleSteps = lifecycleSteps.filter(step => 
        getCategoryForStepType(step.stepType) === stepCategory
      );
    }

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);

    // Format response data
    const formattedSteps = lifecycleSteps.map(step => ({
      id: step.id,
      stepType: step.stepType,
      title: step.title,
      description: step.description,
      createdAt: step.createdAt.toISOString(),
      updatedAt: step.updatedAt.toISOString(),
      priority: step.priority,
      sourceType: step.sourceType,
      sourceUrl: step.sourceUrl,
      isVisible: step.isVisible,
      metadata: step.metadata,
      ecoScoreBefore: step.ecoScoreBefore,
      ecoScoreAfter: step.ecoScoreAfter,
      priceBefore: step.priceBefore,
      priceAfter: step.priceAfter,
      product: step.product,
      tracking: step.tracking,
      user: step.user ? {
        id: step.user.id,
        name: step.user.name,
        telegramUsername: step.user.telegramUsername,
      } : null,
    }));

    return NextResponse.json({
      success: true,
      data: formattedSteps,
      pagination: {
        total: totalCount,
        totalPages,
        currentPage: Math.floor(offset / limit) + 1,
        limit,
        offset,
        hasNext: offset + limit < totalCount,
        hasPrev: offset > 0,
      },
      filters: {
        productId,
        stepCategory,
        sourceType,
        dateRange,
        search,
      },
    }, { headers });

  } catch (error) {
    console.error('Lifecycle steps fetch error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return NextResponse.json(
      { error: 'Failed to fetch lifecycle steps. Please try again.' },
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