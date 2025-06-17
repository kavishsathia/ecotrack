import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStepTypeInfo, getCategoryForStepType } from '@/lib/lifecycle-types';

export async function GET(request: NextRequest) {
  try {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Build where clause for user filtering
    const whereClause: any = {};
    if (userId) {
      whereClause.userId = userId;
    }

    // Get overall statistics
    const [
      totalProducts,
      totalLifecycleSteps,
      recentSteps,
      productStats,
      lifecycleStats
    ] = await Promise.all([
      // Total tracked products
      prisma.productTracking.count({
        where: { ...whereClause, isActive: true },
      }),

      // Total lifecycle steps
      prisma.productLifecycleStep.count({
        where: whereClause,
      }),

      // Recent lifecycle steps (last 7 days)
      prisma.productLifecycleStep.findMany({
        where: {
          ...whereClause,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        },
        include: {
          product: {
            select: {
              canonicalName: true,
              ecoScore: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Product statistics
      prisma.productTracking.findMany({
        where: { ...whereClause, isActive: true },
        include: {
          product: {
            select: {
              ecoScore: true,
              category: true,
            }
          }
        }
      }),

      // Lifecycle step statistics
      prisma.productLifecycleStep.findMany({
        where: whereClause,
        select: {
          stepType: true,
          sourceType: true,
          priority: true,
          ecoScoreBefore: true,
          ecoScoreAfter: true,
          createdAt: true,
        }
      })
    ]);

    // Calculate eco score distribution
    const ecoScores = productStats
      .map(p => p.product.ecoScore)
      .filter(score => score !== null) as number[];
    
    const avgEcoScore = ecoScores.length > 0
      ? Math.round(ecoScores.reduce((sum, score) => sum + score, 0) / ecoScores.length)
      : 0;

    const ecoScoreDistribution = {
      excellent: ecoScores.filter(score => score >= 80).length,
      good: ecoScores.filter(score => score >= 60 && score < 80).length,
      fair: ecoScores.filter(score => score >= 40 && score < 60).length,
      poor: ecoScores.filter(score => score < 40).length,
    };

    // Calculate category distribution
    const categoryDistribution = productStats.reduce((acc, product) => {
      const category = product.product.category || 'Unknown';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate lifecycle step statistics
    const stepTypeDistribution = lifecycleStats.reduce((acc, step) => {
      acc[step.stepType] = (acc[step.stepType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sourceTypeDistribution = lifecycleStats.reduce((acc, step) => {
      acc[step.sourceType] = (acc[step.sourceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate improvements (eco score increases)
    const improvements = lifecycleStats.filter(step => 
      step.ecoScoreBefore !== null && 
      step.ecoScoreAfter !== null && 
      step.ecoScoreAfter > step.ecoScoreBefore
    ).length;

    // High priority events
    const highPriorityEvents = lifecycleStats.filter(step => step.priority >= 8).length;

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentActivity = lifecycleStats.filter(step => 
      new Date(step.createdAt) >= thirtyDaysAgo
    ).length;

    // Format recent steps for display
    const formattedRecentSteps = recentSteps.map(step => {
      const stepInfo = getStepTypeInfo(step.stepType);
      return {
        id: step.id,
        stepType: step.stepType,
        title: step.title,
        description: step.description,
        productName: step.product.canonicalName,
        productEcoScore: step.product.ecoScore,
        createdAt: step.createdAt,
        sourceType: step.sourceType,
        priority: step.priority,
        stepInfo: {
          label: stepInfo.label,
          icon: stepInfo.icon,
          color: stepInfo.color,
        }
      };
    });

    // Calculate trend data (comparing last 7 days vs previous 7 days)
    const previousWeekStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const previousWeekSteps = lifecycleStats.filter(step => {
      const stepDate = new Date(step.createdAt);
      return stepDate >= previousWeekStart && stepDate < lastWeekStart;
    }).length;

    const lastWeekSteps = lifecycleStats.filter(step => {
      const stepDate = new Date(step.createdAt);
      return stepDate >= lastWeekStart;
    }).length;

    const activityTrend = previousWeekSteps > 0 
      ? ((lastWeekSteps - previousWeekSteps) / previousWeekSteps) * 100
      : lastWeekSteps > 0 ? 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalProducts,
          totalLifecycleSteps,
          avgEcoScore,
          improvements,
          highPriorityEvents,
          recentActivity,
          activityTrend: Math.round(activityTrend),
        },
        distributions: {
          ecoScore: ecoScoreDistribution,
          categories: categoryDistribution,
          stepTypes: stepTypeDistribution,
          sources: sourceTypeDistribution,
        },
        recentSteps: formattedRecentSteps,
        timeframes: {
          lastWeek: lastWeekSteps,
          previousWeek: previousWeekSteps,
          last30Days: recentActivity,
        }
      },
    }, { headers });

  } catch (error) {
    console.error('Dashboard overview error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return NextResponse.json(
      { error: 'Failed to fetch dashboard overview' },
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