import { prisma } from '../lib/prisma';

async function seedSampleData() {
  try {
    console.log('🌱 Seeding sample lifecycle data...');

    // Find existing tracked products
    const trackedProducts = await prisma.productTracking.findMany({
      include: {
        product: true,
        lifecycleSteps: true,
      },
      take: 3, // Just work with first 3 products
    });

    if (trackedProducts.length === 0) {
      console.log('No tracked products found. Please track some products first using the extension.');
      return;
    }

    for (const tracking of trackedProducts) {
      const product = tracking.product;
      console.log(`Adding lifecycle steps for: ${product.canonicalName}`);

      // Skip if already has lifecycle steps
      if (tracking.lifecycleSteps.length > 1) {
        console.log(`  - Already has ${tracking.lifecycleSteps.length} steps, skipping...`);
        continue;
      }

      // Add some sample lifecycle steps
      const sampleSteps = [
        {
          stepType: 'sustainability_improved',
          title: 'Eco Score Improvement Detected',
          description: 'Product manufacturer updated their sustainability practices, improving overall eco-friendliness',
          ecoScoreBefore: product.ecoScore ? product.ecoScore - 10 : 50,
          ecoScoreAfter: product.ecoScore || 60,
          priority: 9,
          metadata: {
            improvementReason: 'manufacturer_update',
            certificationAdded: 'organic',
          },
        },
        {
          stepType: 'alternative_found',
          title: 'Better Alternative Discovered',
          description: 'Found a more sustainable alternative with higher eco-score and similar features',
          ecoScoreBefore: product.ecoScore,
          ecoScoreAfter: (product.ecoScore || 0) + 15,
          priority: 7,
          metadata: {
            alternativeProduct: 'Eco-Friendly Alternative',
            improvementPoints: 15,
          },
        },
        {
          stepType: 'price_changed',
          title: 'Price Alert Triggered',
          description: 'Significant price change detected for this product',
          priceBefore: 29.99,
          priceAfter: 24.99,
          priority: 5,
          metadata: {
            discount: 17,
            source: 'price_monitor',
          },
        },
      ];

      // Create each step with some time spacing
      for (let i = 0; i < sampleSteps.length; i++) {
        const step = sampleSteps[i];
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - (sampleSteps.length - i) * 3); // Space them out

        await prisma.productLifecycleStep.create({
          data: {
            trackingId: tracking.id,
            productId: product.id,
            userId: tracking.userId,
            stepType: step.stepType,
            title: step.title,
            description: step.description,
            metadata: step.metadata,
            ecoScoreBefore: step.ecoScoreBefore,
            ecoScoreAfter: step.ecoScoreAfter,
            priceBefore: step.priceBefore,
            priceAfter: step.priceAfter,
            sourceType: 'system',
            priority: step.priority,
            createdAt,
          },
        });

        console.log(`  ✓ Added: ${step.title}`);
      }
    }

    console.log('✅ Sample lifecycle data seeded successfully!');
    console.log('🔗 You can now view the lifecycle data at: http://localhost:3081/dashboard/products');

  } catch (error) {
    console.error('❌ Error seeding sample data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedSampleData();