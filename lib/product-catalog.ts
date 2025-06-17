import { prisma } from './prisma';
import { 
  generateProductEmbeddings, 
  findSimilarProducts, 
  generateContentHash,
  normalizeProductName,
  extractProductFeatures,
  SimilarityResult 
} from './embedding-service';

export interface ProductAnalysisResult {
  productName: string;
  ecoScore: number;
  category?: string;
  materials: string[];
  certifications: string[];
  insights: string[];
  reasoning: string;
}

export interface CatalogEntry {
  product: {
    id: string;
    canonicalName: string;
    canonicalDescription: string;
    ecoScore: number | null;
    category: string | null;
    materials: string[];
    certifications: string[];
    lifecycleInsights: any;
    scanCount: number;
    confidence: number;
  };
  isExisting: boolean;
  similarity?: number;
}

// Main function to lookup or create product in catalog
export async function lookupOrCreateProduct(
  content: any,
  analysis: ProductAnalysisResult
): Promise<CatalogEntry> {
  const startTime = Date.now();
  
  try {
    // Generate content hash for exact duplicate detection
    const contentHash = generateContentHash(content);
    
    // Check for exact content match first
    const exactMatch = await findExactContentMatch(contentHash);
    if (exactMatch) {
      console.log('Found exact content match:', exactMatch.product.canonicalName);
      await incrementScanCount(exactMatch.product.id);
      return {
        product: exactMatch.product,
        isExisting: true,
        similarity: 1.0,
      };
    }
    
    // Generate embeddings for similarity search
    const embeddings = await generateProductEmbeddings(
      analysis.productName,
      content.text || ''
    );
    
    // Find similar products
    const similarProducts = await findSimilarProducts(
      embeddings.nameEmbedding,
      embeddings.descriptionEmbedding,
      0.85 // High threshold for product matching
    );
    
    if (similarProducts.length > 0) {
      // Found similar product - merge data
      console.log(`Found ${similarProducts.length} similar products`);
      const bestMatch = similarProducts[0];
      const mergedProduct = await mergeProductData(bestMatch.productId, content, analysis, contentHash);
      
      return {
        product: mergedProduct,
        isExisting: true,
        similarity: bestMatch.similarity,
      };
    }
    
    // No similar product found - create new one
    console.log('Creating new product in catalog');
    const newProduct = await createNewProduct(content, analysis, embeddings, contentHash);
    
    return {
      product: newProduct,
      isExisting: false,
    };
    
  } catch (error) {
    console.error('Error in product catalog lookup:', error);
    throw error;
  } finally {
    const processingTime = Date.now() - startTime;
    console.log(`Product catalog processing took ${processingTime}ms`);
  }
}

// Find exact content match by hash
async function findExactContentMatch(contentHash: string) {
  const scan = await prisma.productScan.findUnique({
    where: { contentHash },
    include: {
      product: true,
    },
  });
  
  return scan;
}

// Create new product in catalog
async function createNewProduct(
  content: any,
  analysis: ProductAnalysisResult,
  embeddings: { nameEmbedding: number[]; descriptionEmbedding: number[] },
  contentHash: string
) {
  const canonicalName = normalizeProductName(analysis.productName);
  const features = extractProductFeatures(analysis.productName, content.text || '');
  
  // Create comprehensive lifecycle insights
  const lifecycleInsights = {
    features,
    sources: [content.url],
    analysisHistory: [
      {
        timestamp: new Date().toISOString(),
        ecoScore: analysis.ecoScore,
        insights: analysis.insights,
        reasoning: analysis.reasoning,
      },
    ],
    confidence: 1.0,
  };
  
  // Create product and initial scan in transaction
  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        canonicalName: analysis.productName,
        canonicalDescription: content.text?.substring(0, 1000) || '',
        nameEmbedding: JSON.stringify(embeddings.nameEmbedding),
        descriptionEmbedding: JSON.stringify(embeddings.descriptionEmbedding),
        ecoScore: analysis.ecoScore,
        category: analysis.category,
        materials: analysis.materials,
        certifications: analysis.certifications,
        lifecycleInsights,
        scanCount: 1,
        confidence: 1.0,
      },
    });
    
    await tx.productScan.create({
      data: {
        productId: product.id,
        sourceUrl: content.url,
        contentHash,
        rawName: analysis.productName,
        rawDescription: content.text?.substring(0, 1000) || '',
        extractedContent: content,
        aiAnalysis: analysis,
        ecoScore: analysis.ecoScore,
        materials: analysis.materials,
        certifications: analysis.certifications,
        insights: analysis.insights,
        reasoning: analysis.reasoning,
        confidence: 1.0,
      },
    });
    
    return product;
  });
}

// Merge new scan data with existing product
async function mergeProductData(
  productId: string,
  content: any,
  analysis: ProductAnalysisResult,
  contentHash: string
) {
  return await prisma.$transaction(async (tx) => {
    // Get existing product
    const existingProduct = await tx.product.findUnique({
      where: { id: productId },
      include: { scans: true },
    });
    
    if (!existingProduct) {
      throw new Error('Product not found for merging');
    }
    
    // Create new scan record
    await tx.productScan.create({
      data: {
        productId,
        sourceUrl: content.url,
        contentHash,
        rawName: analysis.productName,
        rawDescription: content.text?.substring(0, 1000) || '',
        extractedContent: content,
        aiAnalysis: analysis,
        ecoScore: analysis.ecoScore,
        materials: analysis.materials,
        certifications: analysis.certifications,
        insights: analysis.insights,
        reasoning: analysis.reasoning,
        confidence: 1.0,
      },
    });
    
    // Merge data intelligently
    const mergedData = await mergeProductFields(existingProduct, analysis, content);
    
    // Update product with merged data
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: {
        ...mergedData,
        scanCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    
    return updatedProduct;
  });
}

// Intelligent merging of product fields
async function mergeProductFields(existingProduct: any, newAnalysis: ProductAnalysisResult, content: any) {
  const existing = existingProduct;
  const lifecycle = existing.lifecycleInsights || {};
  
  // Merge materials (union of all unique materials)
  const mergedMaterials = [
    ...new Set([...existing.materials, ...newAnalysis.materials])
  ];
  
  // Merge certifications (union of all unique certifications)
  const mergedCertifications = [
    ...new Set([...existing.certifications, ...newAnalysis.certifications])
  ];
  
  // Update eco score (weighted average based on confidence and scan count)
  const currentScore = existing.ecoScore || 0;
  const newScore = newAnalysis.ecoScore;
  const scanCount = existing.scanCount;
  const weight = 1 / (scanCount + 1); // New scan gets proportional weight
  const mergedEcoScore = Math.round(currentScore * (1 - weight) + newScore * weight);
  
  // Update lifecycle insights
  const updatedLifecycle = {
    ...lifecycle,
    sources: [...new Set([...(lifecycle.sources || []), content.url])],
    analysisHistory: [
      ...(lifecycle.analysisHistory || []),
      {
        timestamp: new Date().toISOString(),
        ecoScore: newAnalysis.ecoScore,
        insights: newAnalysis.insights,
        reasoning: newAnalysis.reasoning,
        source: content.url,
      },
    ],
    lastUpdated: new Date().toISOString(),
  };
  
  // Calculate confidence (higher with more consistent data)
  const confidence = calculateMergedConfidence(existing, newAnalysis);
  
  return {
    ecoScore: mergedEcoScore,
    materials: mergedMaterials,
    certifications: mergedCertifications,
    lifecycleInsights: updatedLifecycle,
    confidence,
    // Keep category if it exists, otherwise use new one
    category: existing.category || newAnalysis.category,
  };
}

// Calculate confidence based on data consistency
function calculateMergedConfidence(existing: any, newAnalysis: ProductAnalysisResult): number {
  let consistencyScore = 0;
  let factors = 0;
  
  // Score consistency (±10 points = good, ±20 = okay, >20 = poor)
  if (existing.ecoScore) {
    const scoreDiff = Math.abs(existing.ecoScore - newAnalysis.ecoScore);
    if (scoreDiff <= 10) consistencyScore += 1;
    else if (scoreDiff <= 20) consistencyScore += 0.5;
    factors++;
  }
  
  // Material consistency
  const commonMaterials = existing.materials.filter((m: string) => 
    newAnalysis.materials.some(nm => nm.toLowerCase().includes(m.toLowerCase()))
  );
  if (existing.materials.length > 0) {
    consistencyScore += commonMaterials.length / existing.materials.length;
    factors++;
  }
  
  // More scans generally increase confidence
  const scanBonus = Math.min(existing.scanCount * 0.1, 0.3);
  
  const baseConfidence = factors > 0 ? consistencyScore / factors : 0.5;
  return Math.min(baseConfidence + scanBonus, 1.0);
}

// Increment scan count for existing exact matches
async function incrementScanCount(productId: string) {
  await prisma.product.update({
    where: { id: productId },
    data: {
      scanCount: { increment: 1 },
      updatedAt: new Date(),
    },
  });
}