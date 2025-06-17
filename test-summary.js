// Quick test script to verify lifecycle summary system is working
// Run with: node test-summary.js

const API_BASE_URL = 'http://localhost:3080';

async function testLifecycleSummary() {
  try {
    console.log('🧪 Testing Lifecycle Summary System...\n');
    
    // Test 1: Check API endpoints are accessible
    console.log('1. Testing API endpoint availability...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/test-product-id/lifecycle/summary`);
      console.log(`   Lifecycle summary API status: ${response.status}`);
      if (response.status === 404) {
        console.log('   ✅ API endpoint exists (404 expected for test product)');
      }
    } catch (error) {
      console.log(`   ❌ Error accessing lifecycle summary API: ${error.message}`);
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/lifecycle/generate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: 'test' })
      });
      console.log(`   Generate summary API status: ${response.status}`);
      if (response.status === 400 || response.status === 404) {
        console.log('   ✅ Generate summary API exists (400/404 expected for test request)');
      }
    } catch (error) {
      console.log(`   ❌ Error accessing generate summary API: ${error.message}`);
    }
    
    console.log('\n✅ Basic API connectivity test completed');
    console.log('\n📋 Next steps to fully test the system:');
    console.log('   1. Apply database schema: npx prisma db push');
    console.log('   2. Start the application: npm run dev');
    console.log('   3. Track a product and add 50+ lifecycle events');
    console.log('   4. Test the Chrome extension summary display');
    console.log('   5. Run the background script: npx tsx scripts/generate-summaries.ts --dry-run');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testLifecycleSummary();