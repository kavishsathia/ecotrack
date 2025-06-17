import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
                canonicalDescription: true,
                ecoScore: true,
                category: true,
                materials: true,
                certifications: true,
                confidence: true,
                scanCount: true,
                firstDiscovered: true,
              },
            },
            lifecycleSteps: {
              orderBy: { createdAt: 'desc' },
              take: 3,
              select: {
                id: true,
                stepType: true,
                title: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json({
        linked: false,
        message: 'Telegram account not linked to any Life app user',
      }, { headers });
    }

    // Format products data
    const products = user.trackedProducts.map(tracked => ({
      trackingId: tracked.id,
      productId: tracked.product.id,
      name: tracked.product.canonicalName,
      description: tracked.product.canonicalDescription,
      ecoScore: tracked.product.ecoScore,
      category: tracked.product.category,
      materials: tracked.product.materials,
      certifications: tracked.product.certifications,
      confidence: tracked.product.confidence,
      scanCount: tracked.product.scanCount,
      firstDiscovered: tracked.product.firstDiscovered,
      trackedAt: tracked.createdAt,
      trackingName: tracked.trackingName,
      notes: tracked.notes,
      recentEvents: tracked.lifecycleSteps,
    }));

    // Calculate statistics
    const validScores = products
      .map(p => p.ecoScore)
      .filter(score => score !== null) as number[];
    
    const avgEcoScore = validScores.length > 0
      ? Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length)
      : 0;

    const categoryStats = products.reduce((acc, product) => {
      const category = product.category || 'Unknown';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalLifecycleEvents = products.reduce((sum, product) => 
      sum + product.recentEvents.length, 0
    );

    return NextResponse.json({
      linked: true,
      products,
      stats: {
        totalProducts: products.length,
        avgEcoScore,
        categoryBreakdown: categoryStats,
        totalLifecycleEvents,
      },
      message: `Found ${products.length} tracked products`,
    }, { headers });

  } catch (error) {
    console.error('Telegram products fetch error:', error);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return NextResponse.json(
      { error: 'Failed to fetch products' },
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