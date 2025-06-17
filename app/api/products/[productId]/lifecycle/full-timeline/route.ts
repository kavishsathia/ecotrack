import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { LifecycleSummaryService } from '@/lib/lifecycle-summary';

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

    // Parse query parameters
    const url = new URL(request.url);
    const includeRawSteps = url.searchParams.get('includeRawSteps') === 'true';
    const maxRecentSteps = parseInt(url.searchParams.get('maxRecentSteps') || '20');

    // Get authenticated user from session
    let authenticatedUserId: string | undefined;
    try {
      const cookieStore = await cookies();
      const userSession = cookieStore.get('user_session');
      
      if (userSession) {
        authenticatedUserId = userSession.value;
      }
    } catch (error) {
      console.log('Session lookup error:', error);
    }

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
            canonicalDescription: true,
            ecoScore: true,
            category: true,
            primaryImageUrl: true,
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

    // Get comprehensive timeline
    const timeline = await LifecycleSummaryService.getComprehensiveTimeline(
      productId,
      authenticatedUserId
    );

    // Get all summaries for context
    const allSummaries = await prisma.productLifecycleSummary.findMany({
      where: {
        productId,
        userId: authenticatedUserId,
      },
      orderBy: {
        stepCountEnd: 'asc',
      },
    });

    // Optionally get raw steps for detailed view
    let rawStepsInSummaries = [];
    if (includeRawSteps && allSummaries.length > 0) {
      // Get steps that are covered by summaries (for reference)
      const lastSummaryStepCount = allSummaries[allSummaries.length - 1]?.stepCountEnd || 0;
      rawStepsInSummaries = await prisma.productLifecycleStep.findMany({
        where: {
          productId,
          userId: authenticatedUserId,
          isVisible: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: lastSummaryStepCount,
        select: {
          id: true,
          stepType: true,
          title: true,
          description: true,
          ecoScoreBefore: true,
          ecoScoreAfter: true,
          sourceType: true,
          createdAt: true,
          priority: true,
        },
      });
    }

    // Build timeline structure
    const timelineItems = [];

    // Add summary blocks
    allSummaries.forEach((summary, index) => {
      timelineItems.push({
        type: 'summary',
        id: summary.id,
        timeframe: {
          stepRange: `${summary.stepCountStart}-${summary.stepCountEnd}`,
          steps: summary.totalStepsIncluded,
          period: summary.timeframe,
        },
        content: {
          summary: summary.summary,
          keyEvents: summary.keyEvents,
          majorMilestones: summary.majorMilestones,
          ecoScoreChange: summary.ecoScoreChange,
          trends: summary.trends,
        },
        metadata: {
          aiModel: summary.aiModel,
          confidence: summary.confidence,
          processingTime: summary.processingTime,
          createdAt: summary.createdAt,
        },
        rawSteps: includeRawSteps ? rawStepsInSummaries.slice(
          summary.stepCountStart - 1,
          summary.stepCountEnd
        ) : [],
      });
    });

    // Add recent steps (not yet summarized)
    if (timeline.recentSteps.length > 0) {
      const recentStepsToShow = timeline.recentSteps.slice(0, maxRecentSteps);
      timelineItems.push({
        type: 'recent_steps',
        id: 'recent',
        timeframe: {
          stepRange: `${timeline.totalStepsProcessed + 1}-${timeline.totalStepsProcessed + timeline.pendingStepsCount}`,
          steps: timeline.pendingStepsCount,
          period: {
            startDate: recentStepsToShow[0]?.createdAt,
            endDate: recentStepsToShow[recentStepsToShow.length - 1]?.createdAt,
          },
        },
        content: {
          summary: `${timeline.pendingStepsCount} recent lifecycle events not yet summarized`,
          steps: recentStepsToShow,
        },
        metadata: {
          pendingCount: timeline.pendingStepsCount,
          nextSummaryAt: Math.ceil((timeline.totalStepsProcessed + timeline.pendingStepsCount) / 50) * 50,
        },
      });
    }

    // Calculate overall statistics
    const totalSteps = timeline.totalStepsProcessed + timeline.pendingStepsCount;
    const overallEcoScoreChange = allSummaries.reduce((sum, s) => sum + (s.ecoScoreChange || 0), 0);
    const allKeyEvents = allSummaries.flatMap(s => s.keyEvents);
    const allMilestones = allSummaries.flatMap(s => s.majorMilestones);

    return NextResponse.json({
      success: true,
      product: {
        id: productTracking.product.id,
        name: productTracking.product.canonicalName,
        description: productTracking.product.canonicalDescription,
        ecoScore: productTracking.product.ecoScore,
        category: productTracking.product.category,
        imageUrl: productTracking.product.primaryImageUrl,
      },
      timeline: {
        items: timelineItems,
        statistics: {
          totalSteps,
          summariesGenerated: allSummaries.length,
          stepsProcessed: timeline.totalStepsProcessed,
          stepsPending: timeline.pendingStepsCount,
          processingProgress: totalSteps > 0 ? (timeline.totalStepsProcessed / totalSteps) * 100 : 0,
          nextSummaryAt: Math.ceil(totalSteps / 50) * 50,
          stepsUntilNextSummary: Math.ceil(totalSteps / 50) * 50 - totalSteps,
        },
        aggregated: {
          overallEcoScoreChange,
          totalKeyEvents: allKeyEvents.length,
          uniqueKeyEvents: [...new Set(allKeyEvents)].length,
          totalMilestones: allMilestones.length,
          uniqueMilestones: [...new Set(allMilestones)].length,
          timeSpan: allSummaries.length > 0 ? {
            start: allSummaries[0].timeframe,
            end: timeline.recentSteps.length > 0 
              ? timeline.recentSteps[timeline.recentSteps.length - 1].createdAt
              : allSummaries[allSummaries.length - 1].timeframe,
          } : null,
        },
      },
      options: {
        includeRawSteps,
        maxRecentSteps,
      },
    }, { headers });

  } catch (error) {
    console.error('Full timeline fetch error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return NextResponse.json(
      { error: 'Failed to fetch full timeline. Please try again.' },
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