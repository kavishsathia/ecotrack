import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStepTypeInfo } from '@/lib/lifecycle-types';

export async function GET(request: NextRequest) {
  try {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    const { searchParams } = new URL(request.url);
    const telegramId = searchParams.get('telegramId');

    if (!telegramId) {
      return NextResponse.json(
        { error: 'Telegram ID required' },
        { status: 400, headers }
      );
    }

    // Find user by Telegram ID
    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        trackedProducts: {
          where: {
            OR: [
              { userId: { not: null } }, // User-specific products
              { userId: null },           // Products tracked before user association
            ],
            isActive: true,
          },
          include: {
            product: {
              select: {
                id: true,
                canonicalName: true,
                ecoScore: true,
                category: true,
              },
            },
          },
        },
        lifecycleSteps: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            product: {
              select: {
                canonicalName: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({
        linked: false,
        message: 'Telegram account not linked to any Life app user',
      }, { headers });
    }

    // Calculate recent activity
    const recentActivity = user.lifecycleSteps.map(step => {
      const stepInfo = getStepTypeInfo(step.stepType);
      return {
        id: step.id,
        title: step.title,
        stepType: step.stepType,
        stepLabel: stepInfo.label,
        stepIcon: stepInfo.icon,
        productName: step.product.canonicalName,
        createdAt: step.createdAt,
        description: step.description,
      };
    });

    // Calculate average eco score
    const validScores = user.trackedProducts
      .map(tp => tp.product.ecoScore)
      .filter(score => score !== null) as number[];
    
    const avgEcoScore = validScores.length > 0
      ? Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length)
      : 0;

    return NextResponse.json({
      linked: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        telegramId: user.telegramId,
        telegramUsername: user.telegramUsername,
        linkedAt: user.telegramLinkedAt,
      },
      stats: {
        trackedProducts: user.trackedProducts.length,
        lifecycleSteps: user.lifecycleSteps.length,
        avgEcoScore,
      },
      recentActivity,
      message: 'Account linked and active',
    }, { headers });

  } catch (error) {
    console.error('Telegram status check error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return NextResponse.json(
      { error: 'Failed to check account status' },
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