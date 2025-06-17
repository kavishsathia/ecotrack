import OpenAI from 'openai';
import crypto from 'crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ProductEmbeddings {
  nameEmbedding: number[];
  descriptionEmbedding: number[];
}

export interface SimilarityResult {
  similarity: number;
  productId: string;
  canonicalName: string;
  confidence: number;
}

// Generate embeddings for product name and description
export async function generateProductEmbeddings(
  name: string, 
  description: string
): Promise<ProductEmbeddings> {
  try {
    // Clean and prepare text for embedding
    const cleanName = cleanTextForEmbedding(name);
    const cleanDescription = cleanTextForEmbedding(description);

    // Generate embeddings in parallel
    const [nameResponse, descriptionResponse] = await Promise.all([
      openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: cleanName,
        dimensions: 1536,
      }),
      openai.embeddings.create({
        model: 'text-embedding-3-small', 
        input: cleanDescription,
        dimensions: 1536,
      }),
    ]);

    return {
      nameEmbedding: nameResponse.data[0].embedding,
      descriptionEmbedding: descriptionResponse.data[0].embedding,
    };
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error('Failed to generate product embeddings');
  }
}

// Calculate cosine similarity between two vectors
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

// Find similar products in the database using embeddings
export async function findSimilarProducts(
  nameEmbedding: number[],
  descriptionEmbedding: number[],
  threshold: number = 0.85
): Promise<SimilarityResult[]> {
  // Note: This is a simplified version. In production, you'd use pgvector
  // for efficient similarity search directly in the database
  
  const { prisma } = await import('./prisma');
  
  try {
    // Get all products with embeddings
    const products = await prisma.product.findMany({
      where: {
        nameEmbedding: { not: null },
        descriptionEmbedding: { not: null },
      },
      select: {
        id: true,
        canonicalName: true,
        nameEmbedding: true,
        descriptionEmbedding: true,
        confidence: true,
      },
    });

    const similarities: SimilarityResult[] = [];

    for (const product of products) {
      if (!product.nameEmbedding || !product.descriptionEmbedding) continue;

      try {
        // Parse stored embeddings (stored as JSON strings)
        const storedNameEmbedding = JSON.parse(product.nameEmbedding);
        const storedDescEmbedding = JSON.parse(product.descriptionEmbedding);

        // Calculate similarities
        const nameSimilarity = calculateCosineSimilarity(nameEmbedding, storedNameEmbedding);
        const descSimilarity = calculateCosineSimilarity(descriptionEmbedding, storedDescEmbedding);

        // Combined similarity (weighted average)
        const combinedSimilarity = (nameSimilarity * 0.7) + (descSimilarity * 0.3);

        if (combinedSimilarity >= threshold) {
          similarities.push({
            similarity: combinedSimilarity,
            productId: product.id,
            canonicalName: product.canonicalName,
            confidence: product.confidence,
          });
        }
      } catch (error) {
        console.error(`Error processing product ${product.id}:`, error);
        continue;
      }
    }

    // Sort by similarity descending
    return similarities.sort((a, b) => b.similarity - a.similarity);
  } catch (error) {
    console.error('Error finding similar products:', error);
    return [];
  }
}

// Generate content hash for exact duplicate detection
export function generateContentHash(content: any): string {
  const contentString = typeof content === 'string' 
    ? content 
    : JSON.stringify(content);
    
  return crypto
    .createHash('sha256')
    .update(contentString)
    .digest('hex');
}

// Clean text for better embedding quality
function cleanTextForEmbedding(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s\-\.]/g, '') // Remove special chars except basic punctuation
    .toLowerCase()
    .substring(0, 2000); // Limit length for embedding API
}

// Normalize product names for better matching
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Extract key product features for better matching
export function extractProductFeatures(name: string, description: string): {
  brand?: string;
  model?: string;
  category?: string;
  features: string[];
} {
  const text = `${name} ${description}`.toLowerCase();
  
  // Common brand patterns
  const brands = ['apple', 'samsung', 'nike', 'adidas', 'sony', 'lg', 'dell', 'hp'];
  const brand = brands.find(b => text.includes(b));
  
  // Extract potential model numbers/names
  const modelMatch = text.match(/\b[a-z0-9]{2,}\s?(pro|max|plus|mini|air|ultra)?\b/i);
  const model = modelMatch?.[0];
  
  // Extract features (colors, sizes, materials, etc.)
  const features: string[] = [];
  const featurePatterns = [
    /\b(black|white|red|blue|green|silver|gold|pink|purple|yellow|orange|gray|grey)\b/g,
    /\b(small|medium|large|xl|xxl|\d+gb|\d+tb|\d+ml|\d+oz)\b/g,
    /\b(organic|eco|sustainable|recycled|biodegradable|natural|bamboo|cotton)\b/g,
  ];
  
  featurePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      features.push(...matches);
    }
  });
  
  return {
    brand,
    model,
    features: [...new Set(features)], // Remove duplicates
  };
}