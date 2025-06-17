import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { LifecycleSummaryService } from '@/lib/lifecycle-summary';
import { getAuthenticatedUserId } from '@/lib/auth-utils';

// Request validation schema
const generateSummarySchema = z.object({
  productId: z.string(),
  forceRegenerate: z.boolean().default(false), // Whether to regenerate existing summaries
  specificStepCount: z.number().optional(), // Generate summary up to specific step count
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
    const validationResult = generateSummarySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400, headers }
      );
    }

    const { productId, forceRegenerate, specificStepCount } = validationResult.data;

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

    // Count total lifecycle steps
    const totalSteps = await prisma.productLifecycleStep.count({
      where: {
        productId,
        userId: authenticatedUserId,
        isVisible: true,
      },
    });

    if (totalSteps < 50) {
      return NextResponse.json({
        success: false,
        message: `Need at least 50 lifecycle steps to generate summary. Currently have ${totalSteps} steps.`,
        totalSteps,
        product: {
          name: productTracking.product.canonicalName,
        },
      }, { headers });
    }

    let summariesGenerated = [];

    if (forceRegenerate) {
      // Delete existing summaries and regenerate all
      await prisma.productLifecycleSummary.deleteMany({
        where: {
          productId,
          userId: authenticatedUserId,
        },
      });

      console.log(`Regenerating all summaries for product ${productId}`);
      summariesGenerated = await LifecycleSummaryService.generateSummaryForExistingData(
        productId,
        authenticatedUserId
      ) || [];
    } else if (specificStepCount) {
      // Generate summary for specific step count
      console.log(`Generating summary up to step ${specificStepCount} for product ${productId}`);
      const summary = await LifecycleSummaryService.generateSummary(
        productId,
        authenticatedUserId,
        specificStepCount
      );
      if (summary) {
        summariesGenerated = [summary];
      }
    } else {
      // Check existing summaries and generate missing ones
      const existingSummaries = await prisma.productLifecycleSummary.findMany({
        where: {
          productId,
          userId: authenticatedUserId,
        },
        orderBy: {
          stepCountEnd: 'desc',
        },
        take: 1,
      });

      const lastProcessedStepCount = existingSummaries[0]?.stepCountEnd || 0;
      const remainingSteps = totalSteps - lastProcessedStepCount;

      if (remainingSteps >= 50) {
        // Generate summary for remaining steps
        const targetStepCount = lastProcessedStepCount + Math.floor(remainingSteps / 50) * 50;
        console.log(`Generating summary from step ${lastProcessedStepCount + 1} to ${targetStepCount}`);
        
        const summary = await LifecycleSummaryService.generateSummary(
          productId,
          authenticatedUserId,
          targetStepCount
        );
        if (summary) {
          summariesGenerated = [summary];
        }
      } else {
        return NextResponse.json({
          success: false,
          message: `Need ${50 - remainingSteps} more steps to generate next summary. Currently have ${remainingSteps} unprocessed steps.`,
          totalSteps,
          lastProcessedStepCount,
          remainingSteps,
          product: {
            name: productTracking.product.canonicalName,
          },
        }, { headers });
      }
    }

    // Get updated timeline
    const timeline = await LifecycleSummaryService.getComprehensiveTimeline(
      productId,
      authenticatedUserId
    );

    return NextResponse.json({
      success: true,
      message: `Generated ${summariesGenerated.length} lifecycle summary${summariesGenerated.length !== 1 ? 'ies' : ''}`,
      summariesGenerated: summariesGenerated.length,
      totalSteps,
      product: {
        name: productTracking.product.canonicalName,
      },
      timeline: {
        totalStepsProcessed: timeline.totalStepsProcessed,
        pendingStepsCount: timeline.pendingStepsCount,
        latestSummary: timeline.latestSummary,
      },
      generatedSummaries: summariesGenerated,
    }, { headers });

  } catch (error) {
    console.error('Summary generation error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return NextResponse.json(
      { error: 'Failed to generate summary. Please try again.' },
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