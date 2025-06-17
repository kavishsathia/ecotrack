import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface LifecycleStep {
  id: string;
  stepType: string;
  title: string;
  description?: string;
  ecoScoreBefore?: number;
  ecoScoreAfter?: number;
  priceBefore?: number;
  priceAfter?: number;
  sourceType: string;
  createdAt: Date;
  metadata?: any;
}

interface SummaryResult {
  summary: string;
  keyEvents: string[];
  trends: any;
  ecoScoreChange?: number;
  majorMilestones: string[];
  timeframe: {
    startDate: string;
    endDate: string;
    durationDays: number;
  };
  confidence: number;
}

const STEPS_PER_SUMMARY = 50;

export class LifecycleSummaryService {
  /**
   * Check if a new summary should be generated after adding a lifecycle step
   */
  static async checkAndGenerateSummary(productId: string, userId?: string): Promise<boolean> {
    try {
      // Count total lifecycle steps for this product/user combination
      const totalSteps = await prisma.productLifecycleStep.count({
        where: {
          productId,
          userId,
          isVisible: true,
        },
      });

      // Check if we've hit a multiple of STEPS_PER_SUMMARY
      if (totalSteps > 0 && totalSteps % STEPS_PER_SUMMARY === 0) {
        console.log(`Triggering summary generation for product ${productId} at ${totalSteps} steps`);
        await this.generateSummary(productId, userId, totalSteps);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking for summary generation:', error);
      return false;
    }
  }

  /**
   * Generate a cumulative summary for a specific range of lifecycle steps
   */
  static async generateSummary(
    productId: string, 
    userId?: string, 
    upToStepCount?: number
  ): Promise<SummaryResult | null> {
    try {
      const startTime = Date.now();

      // Determine the range of steps to summarize
      const endStepCount = upToStepCount || await this.getTotalStepCount(productId, userId);
      const startStepCount = Math.max(1, endStepCount - STEPS_PER_SUMMARY + 1);

      console.log(`Generating summary for steps ${startStepCount}-${endStepCount}`);

      // Get the previous summary (if exists)
      const previousSummary = await this.getPreviousSummary(productId, userId, startStepCount - 1);

      // Get the lifecycle steps for this range
      const lifecycleSteps = await this.getLifecycleStepsInRange(
        productId, 
        userId, 
        startStepCount, 
        endStepCount
      );

      if (lifecycleSteps.length === 0) {
        console.log('No lifecycle steps found for summary generation');
        return null;
      }

      // Get product info for context
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          canonicalName: true,
          canonicalDescription: true,
          ecoScore: true,
          category: true,
        },
      });

      // Generate AI summary
      const summaryResult = await this.generateAISummary(
        lifecycleSteps,
        previousSummary?.summary,
        product
      );

      // Save summary to database
      await this.saveSummary(
        productId,
        userId,
        startStepCount,
        endStepCount,
        lifecycleSteps.length,
        summaryResult,
        Date.now() - startTime
      );

      return summaryResult;
    } catch (error) {
      console.error('Error generating lifecycle summary:', error);
      return null;
    }
  }

  /**
   * Get the most recent complete summary for a product
   */
  static async getLatestSummary(productId: string, userId?: string) {
    return await prisma.productLifecycleSummary.findFirst({
      where: {
        productId,
        userId,
      },
      orderBy: {
        stepCountEnd: 'desc',
      },
    });
  }

  /**
   * Get a comprehensive timeline combining summaries and recent steps
   */
  static async getComprehensiveTimeline(productId: string, userId?: string) {
    const latestSummary = await this.getLatestSummary(productId, userId);
    
    // Get steps after the latest summary
    const recentStepsStartCount = latestSummary ? latestSummary.stepCountEnd + 1 : 1;
    const recentSteps = await this.getLifecycleStepsFromCount(
      productId, 
      userId, 
      recentStepsStartCount
    );

    return {
      latestSummary,
      recentSteps,
      totalStepsProcessed: latestSummary?.stepCountEnd || 0,
      pendingStepsCount: recentSteps.length,
    };
  }

  /**
   * Manual trigger to generate summary for existing data
   */
  static async generateSummaryForExistingData(productId: string, userId?: string) {
    const totalSteps = await this.getTotalStepCount(productId, userId);
    
    if (totalSteps < STEPS_PER_SUMMARY) {
      console.log(`Not enough steps (${totalSteps}) to generate summary`);
      return null;
    }

    // Generate summaries in chunks
    const summariesGenerated = [];
    for (let endCount = STEPS_PER_SUMMARY; endCount <= totalSteps; endCount += STEPS_PER_SUMMARY) {
      const summary = await this.generateSummary(productId, userId, endCount);
      if (summary) {
        summariesGenerated.push(summary);
      }
    }

    return summariesGenerated;
  }

  // Private helper methods

  private static async getTotalStepCount(productId: string, userId?: string): Promise<number> {
    return await prisma.productLifecycleStep.count({
      where: {
        productId,
        userId,
        isVisible: true,
      },
    });
  }

  private static async getPreviousSummary(
    productId: string, 
    userId?: string, 
    beforeStepCount?: number
  ) {
    return await prisma.productLifecycleSummary.findFirst({
      where: {
        productId,
        userId,
        ...(beforeStepCount && { stepCountEnd: { lt: beforeStepCount } }),
      },
      orderBy: {
        stepCountEnd: 'desc',
      },
    });
  }

  private static async getLifecycleStepsInRange(
    productId: string,
    userId?: string,
    startCount?: number,
    endCount?: number
  ): Promise<LifecycleStep[]> {
    const steps = await prisma.productLifecycleStep.findMany({
      where: {
        productId,
        userId,
        isVisible: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      skip: startCount ? startCount - 1 : 0,
      take: endCount && startCount ? endCount - startCount + 1 : STEPS_PER_SUMMARY,
      select: {
        id: true,
        stepType: true,
        title: true,
        description: true,
        ecoScoreBefore: true,
        ecoScoreAfter: true,
        priceBefore: true,
        priceAfter: true,
        sourceType: true,
        createdAt: true,
        metadata: true,
      },
    });

    return steps;
  }

  private static async getLifecycleStepsFromCount(
    productId: string,
    userId?: string,
    fromCount: number
  ): Promise<LifecycleStep[]> {
    const steps = await prisma.productLifecycleStep.findMany({
      where: {
        productId,
        userId,
        isVisible: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      skip: fromCount - 1,
      select: {
        id: true,
        stepType: true,
        title: true,
        description: true,
        ecoScoreBefore: true,
        ecoScoreAfter: true,
        priceBefore: true,
        priceAfter: true,
        sourceType: true,
        createdAt: true,
        metadata: true,
      },
    });

    return steps;
  }

  private static async generateAISummary(
    lifecycleSteps: LifecycleStep[],
    previousSummary?: string,
    product?: any
  ): Promise<SummaryResult> {
    const stepsText = lifecycleSteps.map(step => {
      const ecoChange = step.ecoScoreAfter && step.ecoScoreBefore 
        ? ` (eco score: ${step.ecoScoreBefore} → ${step.ecoScoreAfter})`
        : '';
      const priceChange = step.priceAfter && step.priceBefore
        ? ` (price: $${step.priceBefore} → $${step.priceAfter})`
        : '';
      
      return `${step.createdAt.toISOString()}: ${step.title}${ecoChange}${priceChange}
        Type: ${step.stepType} | Source: ${step.sourceType}
        ${step.description ? `Description: ${step.description}` : ''}`;
    }).join('\n\n');

    const prompt = `You are analyzing the lifecycle journey of a product: "${product?.canonicalName || 'Unknown Product'}"
${product?.canonicalDescription ? `Description: ${product.canonicalDescription}` : ''}
${product?.ecoScore ? `Current Eco Score: ${product.ecoScore}` : ''}

${previousSummary ? `PREVIOUS SUMMARY:\n${previousSummary}\n\n` : ''}

NEW LIFECYCLE EVENTS (${lifecycleSteps.length} events):
${stepsText}

Generate a comprehensive cumulative summary that:
1. ${previousSummary ? 'Integrates the previous summary with new information' : 'Summarizes the lifecycle events'}
2. Identifies key trends and patterns in sustainability and usage
3. Highlights major milestones and significant changes
4. Tracks eco score improvements or declines
5. Notes user behaviors and product journey insights

Respond with a JSON object in this exact format:
{
  "summary": "Comprehensive narrative summary (2-3 paragraphs)",
  "keyEvents": ["Event 1", "Event 2", "Event 3"],
  "trends": {
    "sustainability": "trend description",
    "usage": "usage pattern description", 
    "performance": "performance trend description"
  },
  "ecoScoreChange": <number or null>,
  "majorMilestones": ["Milestone 1", "Milestone 2"],
  "confidence": <number between 0 and 1>
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      if (!response) {
        throw new Error('No response from AI');
      }

      const result = JSON.parse(response);
      
      // Add timeframe information
      const timeframe = {
        startDate: lifecycleSteps[0]?.createdAt.toISOString() || new Date().toISOString(),
        endDate: lifecycleSteps[lifecycleSteps.length - 1]?.createdAt.toISOString() || new Date().toISOString(),
        durationDays: Math.ceil(
          (new Date(lifecycleSteps[lifecycleSteps.length - 1]?.createdAt || new Date()).getTime() - 
           new Date(lifecycleSteps[0]?.createdAt || new Date()).getTime()) / (1000 * 60 * 60 * 24)
        ),
      };

      return {
        ...result,
        timeframe,
        confidence: result.confidence || 0.8,
      };

    } catch (error) {
      console.error('Error generating AI summary:', error);
      
      // Fallback summary
      const timeframe = {
        startDate: lifecycleSteps[0]?.createdAt.toISOString() || new Date().toISOString(),
        endDate: lifecycleSteps[lifecycleSteps.length - 1]?.createdAt.toISOString() || new Date().toISOString(),
        durationDays: Math.ceil(
          (new Date(lifecycleSteps[lifecycleSteps.length - 1]?.createdAt || new Date()).getTime() - 
           new Date(lifecycleSteps[0]?.createdAt || new Date()).getTime()) / (1000 * 60 * 60 * 24)
        ),
      };

      return {
        summary: `Product lifecycle summary covering ${lifecycleSteps.length} events. ${previousSummary ? 'Building on previous tracking history. ' : ''}Key activities include tracking, monitoring, and updates.`,
        keyEvents: lifecycleSteps.slice(0, 3).map(step => step.title),
        trends: {
          general: 'Active monitoring and engagement with product lifecycle',
        },
        majorMilestones: lifecycleSteps.filter(step => step.priority >= 8).map(step => step.title),
        timeframe,
        confidence: 0.6,
      };
    }
  }

  private static async saveSummary(
    productId: string,
    userId: string | undefined,
    stepCountStart: number,
    stepCountEnd: number,
    totalStepsIncluded: number,
    summaryResult: SummaryResult,
    processingTime: number
  ) {
    await prisma.productLifecycleSummary.create({
      data: {
        productId,
        userId,
        stepCountStart,
        stepCountEnd,
        totalStepsIncluded,
        summary: summaryResult.summary,
        keyEvents: summaryResult.keyEvents,
        trends: summaryResult.trends,
        ecoScoreChange: summaryResult.ecoScoreChange,
        majorMilestones: summaryResult.majorMilestones,
        timeframe: summaryResult.timeframe,
        aiModel: 'gpt-4o-mini',
        processingTime,
        confidence: summaryResult.confidence,
      },
    });
  }
}