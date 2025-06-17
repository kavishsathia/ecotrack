/**
 * Background script to generate lifecycle summaries for existing data
 * Run with: npx tsx scripts/generate-summaries.ts
 */

import { prisma } from '../lib/prisma';
import { LifecycleSummaryService } from '../lib/lifecycle-summary';

interface ProductWithSteps {
  productId: string;
  userId: string | null;
  productName: string;
  totalSteps: number;
  existingSummaries: number;
  pendingSteps: number;
}

async function findProductsNeedingSummaries(): Promise<ProductWithSteps[]> {
  console.log('🔍 Finding products that need lifecycle summaries...');

  // Get all products with significant lifecycle data
  const productsWithSteps = await prisma.productTracking.findMany({
    where: {
      isActive: true,
    },
    include: {
      product: {
        select: {
          canonicalName: true,
        }
      },
      _count: {
        select: {
          lifecycleSteps: {
            where: {
              isVisible: true,
            }
          }
        }
      }
    }
  });

  const results: ProductWithSteps[] = [];

  for (const tracking of productsWithSteps) {
    const totalSteps = tracking._count.lifecycleSteps;
    
    if (totalSteps >= 50) { // Only process products with enough steps
      // Count existing summaries
      const existingSummaries = await prisma.productLifecycleSummary.count({
        where: {
          productId: tracking.productId,
          userId: tracking.userId,
        }
      });

      const lastSummary = await prisma.productLifecycleSummary.findFirst({
        where: {
          productId: tracking.productId,
          userId: tracking.userId,
        },
        orderBy: {
          stepCountEnd: 'desc',
        }
      });

      const processedSteps = lastSummary?.stepCountEnd || 0;
      const pendingSteps = totalSteps - processedSteps;

      if (pendingSteps >= 50 || existingSummaries === 0) {
        results.push({
          productId: tracking.productId,
          userId: tracking.userId,
          productName: tracking.product.canonicalName,
          totalSteps,
          existingSummaries,
          pendingSteps,
        });
      }
    }
  }

  return results;
}

async function generateSummariesForProduct(product: ProductWithSteps): Promise<boolean> {
  try {
    console.log(`📝 Generating summaries for "${product.productName}" (${product.totalSteps} steps)`);
    
    const summaries = await LifecycleSummaryService.generateSummaryForExistingData(
      product.productId,
      product.userId || undefined
    );

    if (summaries && summaries.length > 0) {
      console.log(`✅ Generated ${summaries.length} summaries for "${product.productName}"`);
      return true;
    } else {
      console.log(`⚠️  No summaries generated for "${product.productName}"`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error generating summaries for "${product.productName}":`, error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting lifecycle summary generation process...\n');

  try {
    const productsNeedingSummaries = await findProductsNeedingSummaries();
    
    console.log(`Found ${productsNeedingSummaries.length} products needing summaries:\n`);
    
    productsNeedingSummaries.forEach((product, index) => {
      console.log(`${index + 1}. ${product.productName}`);
      console.log(`   - Total steps: ${product.totalSteps}`);
      console.log(`   - Existing summaries: ${product.existingSummaries}`);
      console.log(`   - Pending steps: ${product.pendingSteps}`);
      console.log(`   - User: ${product.userId || 'Anonymous'}\n`);
    });

    if (productsNeedingSummaries.length === 0) {
      console.log('🎉 All products are up to date with summaries!');
      return;
    }

    // Process products one by one to avoid overwhelming the AI API
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < productsNeedingSummaries.length; i++) {
      const product = productsNeedingSummaries[i];
      
      console.log(`\n[${i + 1}/${productsNeedingSummaries.length}] Processing "${product.productName}"...`);
      
      const success = await generateSummariesForProduct(product);
      
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Add a small delay to avoid rate limiting
      if (i < productsNeedingSummaries.length - 1) {
        console.log('⏳ Waiting 2 seconds before next product...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n📊 Summary Generation Complete:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log(`📈 Success rate: ${((successCount / (successCount + failureCount)) * 100).toFixed(1)}%`);

    // Show updated statistics
    const totalSummaries = await prisma.productLifecycleSummary.count();
    const totalProcessedSteps = await prisma.productLifecycleSummary.aggregate({
      _sum: {
        totalStepsIncluded: true,
      }
    });

    console.log('\n📈 Overall Statistics:');
    console.log(`📝 Total summaries in database: ${totalSummaries}`);
    console.log(`📊 Total steps processed: ${totalProcessedSteps._sum.totalStepsIncluded || 0}`);

  } catch (error) {
    console.error('💥 Fatal error in summary generation process:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Database connection closed.');
  }
}

// Handle script arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');
const forceAll = args.includes('--force') || args.includes('-f');

if (dryRun) {
  console.log('🧪 DRY RUN MODE - No summaries will be generated\n');
  
  findProductsNeedingSummaries().then(products => {
    console.log(`Found ${products.length} products that would get summaries:`);
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.productName} (${product.pendingSteps} pending steps)`);
    });
    process.exit(0);
  });
} else {
  main();
}

export { findProductsNeedingSummaries, generateSummariesForProduct };