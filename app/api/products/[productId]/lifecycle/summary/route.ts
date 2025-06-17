import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LifecycleSummaryService } from '@/lib/lifecycle-summary';
import { getAuthenticatedUserId } from '@/lib/auth-utils';

interface RouteParams {
  params: {
    productId: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Add CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    const { productId } = params;

    // Get authenticated user from session
    const authenticatedUserId = await getAuthenticatedUserId();

    // Verify product exists and user has access
    const productTracking = await prisma.productTracking.findFirst({
      where: {
        productId,
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
          }
        }
      }
    });

    if (!productTracking) {
      return NextResponse.json(
        { error: 'Product not found or access denied' },
        { status: 404, headers }
      );
    }

    // Get comprehensive timeline (summaries + recent steps)
    const timeline = await LifecycleSummaryService.getComprehensiveTimeline(
      productId,
      authenticatedUserId
    );

    // Get all summaries for this product
    const allSummaries = await prisma.productLifecycleSummary.findMany({
      where: {
        productId,
        userId: authenticatedUserId,
      },
      orderBy: {
        stepCountEnd: 'asc',
      },
    });

    // Calculate overall statistics
    const totalStepsProcessed = timeline.totalStepsProcessed;
    const pendingStepsCount = timeline.pendingStepsCount;
    const totalSteps = totalStepsProcessed + pendingStepsCount;

    // Get overall eco score trend from summaries
    const ecoScoreTrend = allSummaries
      .filter(s => s.ecoScoreChange !== null)
      .map(s => s.ecoScoreChange)
      .reduce((sum, change) => sum! + change!, 0) || 0;

    // Aggregate key events and milestones
    const allKeyEvents = allSummaries.flatMap(s => s.keyEvents);
    const allMilestones = allSummaries.flatMap(s => s.majorMilestones);

    return NextResponse.json({
      success: true,
      product: {
        id: productTracking.product.id,
        name: productTracking.product.canonicalName,
        ecoScore: productTracking.product.ecoScore,
        category: productTracking.product.category,
      },
      summary: {
        latest: timeline.latestSummary,
        all: allSummaries,
        statistics: {
          totalSteps,
          totalStepsProcessed,
          pendingStepsCount,
          summariesGenerated: allSummaries.length,
          ecoScoreTrend,
          timeSpan: allSummaries.length > 0 ? {
            start: allSummaries[0].timeframe,
            end: allSummaries[allSummaries.length - 1].timeframe,
          } : null,
        },
        aggregated: {
          keyEvents: [...new Set(allKeyEvents)].slice(0, 10), // Unique events, top 10
          majorMilestones: [...new Set(allMilestones)].slice(0, 5), // Unique milestones, top 5
        },
      },
      recentSteps: timeline.recentSteps.slice(0, 10), // Latest 10 steps not yet summarized
    }, { headers });

  } catch (error) {
    console.error('Lifecycle summary fetch error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return NextResponse.json(
      { error: 'Failed to fetch lifecycle summary. Please try again.' },
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