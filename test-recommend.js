// Quick test to verify recommendations API fix
// Run with: node test-recommend.js

const API_BASE_URL = 'http://localhost:3080';

async function testRecommendationsAPI() {
  try {
    console.log('🧪 Testing Recommendations API with new image format...\n');
    
    // Test with new image object format
    const testContent = {
      url: 'https://example.com/product',
      title: 'Test Sustainable Product',
      text: 'This is a test sustainable product with great eco features',
      images: [
        {
          url: 'https://example.com/image1.jpg',
          alt: 'Product image',
          title: 'Main product image',
          width: 400,
          height: 300,
          area: 120000,
          aspectRatio: 1.33,
          visible: true
        },
        {
          url: 'https://example.com/image2.jpg',
          alt: 'Detail image',
          width: 200,
          height: 200,
          area: 40000,
          aspectRatio: 1.0,
          visible: true
        }
      ]
    };

    const response = await fetch(`${API_BASE_URL}/api/products/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: testContent,
        minEcoScore: 60,
        limit: 3
      })
    });

    console.log(`Response status: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Recommendations API accepts new image format');
      console.log(`   Success: ${result.success}`);
      console.log(`   Message: ${result.message || 'No message'}`);
    } else {
      const error = await response.json();
      console.log('❌ API still has validation errors:');
      console.log(JSON.stringify(error, null, 2));
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testRecommendationsAPI();