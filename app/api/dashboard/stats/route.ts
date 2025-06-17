import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

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
      }
    } catch (error) {
      console.log('Session lookup error:', error);
    }

    // Return guest stats if not authenticated
    if (!authenticatedUserId) {
      return NextResponse.json({
        success: true,
        stats: {
          trackedProductsCount: 0,
          averageEcoScore: 0,
          totalLifecycleSteps: 0,
          improvementsCount: 0,
          recommendationsCount: 0,
          recentActivity: [],
          topCategories: [],
          ecoScoreDistribution: [],
        },
        isGuest: true,
      }, { headers });
    }

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
            primaryImageUrl: true,
          }
        },
        lifecycleSteps: {
          where: {
            isVisible: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            stepType: true,
            title: true,
            description: true,
            ecoScoreBefore: true,
            ecoScoreAfter: true,
            sourceType: true,
            createdAt: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate stats
    const trackedProductsCount = trackedProducts.length;
    
    // Average eco score of tracked products
    const ecoScores = trackedProducts
      .map(tp => tp.product.ecoScore)
      .filter(score => score !== null) as number[];
    const averageEcoScore = ecoScores.length > 0 
      ? Math.round(ecoScores.reduce((sum, score) => sum + score, 0) / ecoScores.length)
      : 0;

    // Total lifecycle steps
    const totalLifecycleSteps = trackedProducts.reduce((sum, tp) => sum + tp.lifecycleSteps.length, 0);

    // Count improvements (lifecycle steps with eco score improvements)
    const improvementsCount = trackedProducts.reduce((sum, tp) => {
      return sum + tp.lifecycleSteps.filter(step => 
        step.ecoScoreAfter && step.ecoScoreBefore && 
        step.ecoScoreAfter > step.ecoScoreBefore
      ).length;
    }, 0);

    // Get recent activity (all lifecycle steps from tracked products)
    const recentActivity = trackedProducts
      .flatMap(tp => tp.lifecycleSteps.map(step => ({
        ...step,
        productName: tp.product.canonicalName,
        productImage: tp.product.primaryImageUrl,
      })))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    // Top categories
    const categoryCount = trackedProducts.reduce((acc, tp) => {
      const category = tp.product.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topCategories = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    // Eco score distribution
    const ecoScoreDistribution = [
      { range: '80-100', label: 'Excellent', count: ecoScores.filter(s => s >= 80).length, color: 'green' },
      { range: '60-79', label: 'Good', count: ecoScores.filter(s => s >= 60 && s < 80).length, color: 'blue' },
      { range: '40-59', label: 'Fair', count: ecoScores.filter(s => s >= 40 && s < 60).length, color: 'yellow' },
      { range: '0-39', label: 'Poor', count: ecoScores.filter(s => s < 40).length, color: 'red' },
    ];

    // Get lifecycle summaries statistics
    const lifecycleSummaries = await prisma.productLifecycleSummary.findMany({
      where: {
        userId: authenticatedUserId,
      },
      select: {
        id: true,
        stepCountEnd: true,
        ecoScoreChange: true,
        majorMilestones: true,
        keyEvents: true,
        createdAt: true,
        product: {
          select: {
            canonicalName: true,
          }
        }
      },
    });

    const summariesCount = lifecycleSummaries.length;
    const totalProcessedSteps = lifecycleSummaries.reduce((sum, s) => sum + s.stepCountEnd, 0);
    const overallEcoScoreChange = lifecycleSummaries.reduce((sum, s) => sum + (s.ecoScoreChange || 0), 0);
    const allMilestones = lifecycleSummaries.flatMap(s => s.majorMilestones);

    // Get recommendations count (simulate this for now)
    const recommendationsCount = Math.max(0, trackedProductsCount * 2 - 3); // Rough estimate

    return NextResponse.json({
      success: true,
      stats: {
        trackedProductsCount,
        averageEcoScore,
        totalLifecycleSteps,
        improvementsCount,
        recommendationsCount,
        recentActivity,
        topCategories,
        ecoScoreDistribution,
        // New summary-related stats
        summariesGenerated: summariesCount,
        stepsProcessedInSummaries: totalProcessedSteps,
        overallEcoScoreChange,
        totalMilestones: allMilestones.length,
        summaryInsights: {
          averageStepsPerSummary: summariesCount > 0 ? Math.round(totalProcessedSteps / summariesCount) : 0,
          mostRecentSummary: lifecycleSummaries.length > 0 
            ? lifecycleSummaries[lifecycleSummaries.length - 1].createdAt 
            : null,
          productsWithSummaries: [...new Set(lifecycleSummaries.map(s => s.product.canonicalName))].length,
        },
      },
      isGuest: false,
    }, { headers });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats. Please try again.' },
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