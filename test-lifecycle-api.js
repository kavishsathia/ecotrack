// Test script to verify lifecycle summary API connectivity
// Run with: node test-lifecycle-api.js

const API_BASE_URL = 'http://localhost:3080';

async function testLifecycleAPI() {
  console.log('🧪 Testing Lifecycle Summary API...\n');
  
  // Test 1: Check if API endpoint exists
  console.log('1. Testing API endpoint availability...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/products/test-product-id/lifecycle/summary`);
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 404) {
      console.log('   ✅ API endpoint accessible (404 expected for test product)');
    } else if (response.status === 401) {
      console.log('   ✅ API endpoint accessible (401 expected without auth)');
    } else {
      console.log(`   ⚠️  Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ API endpoint not accessible: ${error.message}`);
  }
  
  // Test 2: Check analysis API to see if productId is returned
  console.log('\n2. Testing analysis API for productId...');
  try {
    const testContent = {
      url: 'https://example.com/test-product',
      title: 'Test Sustainable Product',
      text: 'This is a test product for sustainability analysis',
      images: []
    };
    
    const response = await fetch(`${API_BASE_URL}/api/products/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: testContent })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`   Status: ${response.status}`);
      console.log(`   Has catalogData: ${!!result.catalogData}`);
      console.log(`   Has productId: ${!!result.catalogData?.productId}`);
      if (result.catalogData?.productId) {
        console.log(`   Product ID: ${result.catalogData.productId}`);
      }
    } else {
      console.log(`   ❌ Analysis API failed: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Analysis API error: ${error.message}`);
  }
  
  console.log('\n📋 Next steps for debugging:');
  console.log('   1. Check browser console for detailed logs');
  console.log('   2. Verify the server is running on http://localhost:3080');
  console.log('   3. Check if user is logged in for authentication');
  console.log('   4. Verify the product has been tracked for lifecycle data');
}

testLifecycleAPI();