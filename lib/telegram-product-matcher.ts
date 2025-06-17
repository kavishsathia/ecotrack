import { generateProductEmbeddings, calculateCosineSimilarity, normalizeProductName, extractProductFeatures } from './embedding-service';
import { prisma } from './prisma';

interface ProductIdentificationResult {
  productName: string;
  category: string;
  confidence: number;
  description: string;
  condition?: string;
  brand?: string;
}

interface TrackedProduct {
  id: string;
  productId: string;
  product: {
    id: string;
    canonicalName: string;
    canonicalDescription: string;
    category: string | null;
    nameEmbedding: string | null;
    descriptionEmbedding: string | null;
    ecoScore: number | null;
  };
}

interface ProductMatchResult {
  trackedProduct: TrackedProduct;
  confidence: number;
  matchReason: string;
  similarityScore: number;
}

/**
 * Advanced product matching for Telegram bot using multiple strategies:
 * 1. Embedding similarity (if available)
 * 2. Name/keyword matching
 * 3. Category matching
 * 4. Feature extraction matching
 */
export class TelegramProductMatcher {
  
  /**
   * Find the best matching product from user's tracked products
   */
  static async findBestMatch(
    trackedProducts: TrackedProduct[],
    productIdentification: ProductIdentificationResult | null,
    userText: string
  ): Promise<ProductMatchResult | null> {
    
    if (trackedProducts.length === 0) {
      return null;
    }

    // If only one product tracked, return it with moderate confidence
    if (trackedProducts.length === 1) {
      return {
        trackedProduct: trackedProducts[0],
        confidence: 60,
        matchReason: 'Only tracked product',
        similarityScore: 0.6,
      };
    }

    const candidates: ProductMatchResult[] = [];

    // Strategy 1: Embedding-based matching (most accurate)
    if (productIdentification) {
      const embeddingMatches = await this.findEmbeddingMatches(
        trackedProducts, 
        productIdentification
      );
      candidates.push(...embeddingMatches);
    }

    // Strategy 2: Text-based matching
    const textMatches = await this.findTextMatches(trackedProducts, userText, productIdentification);
    candidates.push(...textMatches);

    // Strategy 3: Category-based matching
    if (productIdentification?.category) {
      const categoryMatches = this.findCategoryMatches(trackedProducts, productIdentification.category);
      candidates.push(...categoryMatches);
    }

    // Remove duplicates and sort by confidence
    const uniqueCandidates = this.deduplicateMatches(candidates);
    const sortedCandidates = uniqueCandidates.sort((a, b) => b.confidence - a.confidence);

    // Return best match if confidence is above threshold
    const bestMatch = sortedCandidates[0];
    if (bestMatch && bestMatch.confidence >= 30) {
      return bestMatch;
    }

    return null;
  }

  /**
   * Find matches using embedding similarity
   */
  private static async findEmbeddingMatches(
    trackedProducts: TrackedProduct[],
    productIdentification: ProductIdentificationResult
  ): Promise<ProductMatchResult[]> {
    
    try {
      // Generate embeddings for identified product
      const { nameEmbedding, descriptionEmbedding } = await generateProductEmbeddings(
        productIdentification.productName,
        productIdentification.description
      );

      const matches: ProductMatchResult[] = [];

      for (const tracked of trackedProducts) {
        const product = tracked.product;
        
        if (!product.nameEmbedding || !product.descriptionEmbedding) {
          continue;
        }

        try {
          // Parse stored embeddings
          const storedNameEmbedding = JSON.parse(product.nameEmbedding);
          const storedDescEmbedding = JSON.parse(product.descriptionEmbedding);

          // Calculate similarities
          const nameSimilarity = calculateCosineSimilarity(nameEmbedding, storedNameEmbedding);
          const descSimilarity = calculateCosineSimilarity(descriptionEmbedding, storedDescEmbedding);

          // Weighted combination (name is more important for matching)
          const combinedSimilarity = (nameSimilarity * 0.8) + (descSimilarity * 0.2);
          
          if (combinedSimilarity > 0.3) { // Lower threshold for Telegram matching
            matches.push({
              trackedProduct: tracked,
              confidence: Math.round(combinedSimilarity * 100),
              matchReason: `Embedding similarity (${Math.round(combinedSimilarity * 100)}%)`,
              similarityScore: combinedSimilarity,
            });
          }
        } catch (error) {
          console.error(`Error processing embeddings for product ${product.id}:`, error);
          continue;
        }
      }

      return matches;
    } catch (error) {
      console.error('Error in embedding matching:', error);
      return [];
    }
  }

  /**
   * Find matches using text/keyword analysis
   */
  private static async findTextMatches(
    trackedProducts: TrackedProduct[],
    userText: string,
    productIdentification: ProductIdentificationResult | null
  ): Promise<ProductMatchResult[]> {
    
    const matches: ProductMatchResult[] = [];
    const searchText = `${userText} ${productIdentification?.productName || ''} ${productIdentification?.description || ''}`.toLowerCase();

    for (const tracked of trackedProducts) {
      const product = tracked.product;
      const productNameLower = normalizeProductName(product.canonicalName);
      const productDescLower = product.canonicalDescription.toLowerCase();
      
      let confidence = 0;
      let matchReasons: string[] = [];

      // Exact name match
      if (searchText.includes(productNameLower)) {
        confidence += 90;
        matchReasons.push('Exact name match');
      }

      // Partial name match
      const nameWords = productNameLower.split(' ').filter(word => word.length > 2);
      let nameWordsMatched = 0;
      for (const word of nameWords) {
        if (searchText.includes(word)) {
          nameWordsMatched++;
        }
      }
      
      if (nameWordsMatched > 0) {
        const nameMatchScore = (nameWordsMatched / nameWords.length) * 70;
        confidence += nameMatchScore;
        matchReasons.push(`Name words: ${nameWordsMatched}/${nameWords.length}`);
      }

      // Brand matching
      if (productIdentification?.brand) {
        const brandNormalized = normalizeProductName(productIdentification.brand);
        if (productNameLower.includes(brandNormalized) || productDescLower.includes(brandNormalized)) {
          confidence += 40;
          matchReasons.push('Brand match');
        }
      }

      // Feature matching
      if (productIdentification) {
        const identifiedFeatures = extractProductFeatures(
          productIdentification.productName, 
          productIdentification.description
        );
        const productFeatures = extractProductFeatures(
          product.canonicalName, 
          product.canonicalDescription
        );

        // Check for common features
        const commonFeatures = identifiedFeatures.features.filter(f => 
          productFeatures.features.includes(f)
        );
        
        if (commonFeatures.length > 0) {
          confidence += commonFeatures.length * 10;
          matchReasons.push(`Common features: ${commonFeatures.join(', ')}`);
        }
      }

      // Keyword density matching
      const productKeywords = this.extractKeywords(product.canonicalName + ' ' + product.canonicalDescription);
      const searchKeywords = this.extractKeywords(searchText);
      const keywordOverlap = this.calculateKeywordOverlap(productKeywords, searchKeywords);
      
      if (keywordOverlap > 0.2) {
        confidence += keywordOverlap * 30;
        matchReasons.push(`Keyword overlap: ${Math.round(keywordOverlap * 100)}%`);
      }

      if (confidence > 20) {
        matches.push({
          trackedProduct: tracked,
          confidence: Math.min(95, Math.round(confidence)), // Cap at 95%
          matchReason: matchReasons.join(', '),
          similarityScore: confidence / 100,
        });
      }
    }

    return matches;
  }

  /**
   * Find matches by category
   */
  private static findCategoryMatches(
    trackedProducts: TrackedProduct[],
    identifiedCategory: string
  ): ProductMatchResult[] {
    
    const matches: ProductMatchResult[] = [];
    const categoryLower = identifiedCategory.toLowerCase();

    for (const tracked of trackedProducts) {
      const product = tracked.product;
      const productCategory = (product.category || '').toLowerCase();

      if (productCategory && this.areCategoriesSimilar(categoryLower, productCategory)) {
        matches.push({
          trackedProduct: tracked,
          confidence: 40,
          matchReason: `Category match: ${product.category}`,
          similarityScore: 0.4,
        });
      }
    }

    return matches;
  }

  /**
   * Remove duplicate matches and combine scores
   */
  private static deduplicateMatches(matches: ProductMatchResult[]): ProductMatchResult[] {
    const productMap = new Map<string, ProductMatchResult>();

    for (const match of matches) {
      const productId = match.trackedProduct.productId;
      const existing = productMap.get(productId);

      if (!existing || match.confidence > existing.confidence) {
        // Combine match reasons if there's an existing match
        const combinedReason = existing 
          ? `${existing.matchReason}; ${match.matchReason}`
          : match.matchReason;

        productMap.set(productId, {
          ...match,
          matchReason: combinedReason,
          confidence: Math.max(match.confidence, existing?.confidence || 0),
        });
      }
    }

    return Array.from(productMap.values());
  }

  /**
   * Extract meaningful keywords from text
   */
  private static extractKeywords(text: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates
  }

  /**
   * Calculate keyword overlap percentage
   */
  private static calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));

    return intersection.size / Math.max(set1.size, set2.size);
  }

  /**
   * Check if two categories are similar
   */
  private static areCategoriesSimilar(cat1: string, cat2: string): boolean {
    if (cat1 === cat2) return true;

    // Define category synonyms
    const categorySynonyms: Record<string, string[]> = {
      'electronics': ['tech', 'technology', 'gadgets', 'devices'],
      'clothing': ['apparel', 'fashion', 'wear', 'garments'],
      'food': ['nutrition', 'edibles', 'consumables'],
      'beauty': ['cosmetics', 'skincare', 'personal care'],
      'home': ['household', 'domestic', 'living'],
      'sports': ['fitness', 'exercise', 'athletic'],
    };

    for (const [category, synonyms] of Object.entries(categorySynonyms)) {
      if ((cat1.includes(category) || synonyms.some(s => cat1.includes(s))) &&
          (cat2.includes(category) || synonyms.some(s => cat2.includes(s)))) {
        return true;
      }
    }

    return false;
  }
}