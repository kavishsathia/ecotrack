'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Heart,
  Star,
  Leaf,
  Package,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Plus,
  Filter,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface RecommendedProduct {
  id: string;
  name: string;
  description: string;
  ecoScore: number;
  category: string;
  materials: string[];
  certifications: string[];
  price?: string;
  originalPrice?: string;
  imageUrl: string;
  sourceUrl?: string;
  confidence: number;
  improvementScore: number;
  reasonForRecommendation: string;
  sustainabilityHighlights: string[];
  basedOnProduct: {
    id: string;
    name: string;
    ecoScore: number;
  };
  cardHeight: 'small' | 'medium' | 'large'; // For Pinterest-style layout
}

const getEcoScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600 bg-green-50';
  if (score >= 60) return 'text-blue-600 bg-blue-50';
  if (score >= 40) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
};

const getEcoScoreLabel = (score: number) => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
};


export default function RecommendationsPage() {
  const [products, setProducts] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [likedProducts, setLikedProducts] = useState<Set<string>>(new Set());

  const categories = ['All', 'Clothing', 'Personal Care', 'Electronics', 'Drinkware', 'Fitness', 'Cleaning'];

  useEffect(() => {
    fetchRecommendations();
  }, [selectedCategory]);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '12',
        minEcoScoreImprovement: '10',
      });

      if (selectedCategory !== 'All') {
        params.append('categories', selectedCategory);
      }

      const response = await fetch(`/api/recommendations/user?${params}`);
      const result = await response.json();

      if (result.success) {
        setProducts(result.recommendations || []);
        setError(null);
      } else {
        setError(result.error || 'Failed to load recommendations');
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products; // API handles filtering

  const toggleLike = (productId: string) => {
    const newLiked = new Set(likedProducts);
    if (newLiked.has(productId)) {
      newLiked.delete(productId);
    } else {
      newLiked.add(productId);
    }
    setLikedProducts(newLiked);
  };

  const handleTrackProduct = (productId: string) => {
    console.log('Track product:', productId);
    // TODO: Implement tracking functionality
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading personalized recommendations...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Recommendations</h1>
            <p className="text-gray-600 mt-1">
              Better sustainable alternatives to your tracked products
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="bg-purple-50 text-purple-700">
              <Sparkles className="mr-1 h-3 w-3" />
              {filteredProducts.length} suggestions
            </Badge>
            <Button variant="outline" size="sm" onClick={fetchRecommendations}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Category Filter */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filter by category:</span>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className={selectedCategory === category ? "bg-teal-600 hover:bg-teal-700" : ""}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Pinterest-style Grid */}
        {!loading && filteredProducts.length === 0 && !error ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No better alternatives found</h3>
            <p className="text-gray-600 mb-4">
              Track some products first to get personalized sustainability recommendations.
            </p>
            <Button className="bg-teal-600 hover:bg-teal-700">
              <Plus className="mr-2 h-4 w-4" />
              Track Your First Product
            </Button>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isLiked={likedProducts.has(product.id)}
                onLike={() => toggleLike(product.id)}
                onTrack={() => handleTrackProduct(product.id)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

interface ProductCardProps {
  product: RecommendedProduct;
  isLiked: boolean;
  onLike: () => void;
  onTrack: () => void;
}

function ProductCard({ product, isLiked, onLike, onTrack }: ProductCardProps) {
  const getCardHeight = (height: string) => {
    switch (height) {
      case 'small': return 'h-64';
      case 'medium': return 'h-80';
      case 'large': return 'h-96';
      default: return 'h-80';
    }
  };

  return (
    <div className="break-inside-avoid mb-4">
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 group">
        {/* Image */}
        <div className={`relative ${getCardHeight(product.cardHeight)} overflow-hidden`}>
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
          <div className="absolute top-3 right-3 flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLike}
              className={`p-2 rounded-full ${
                isLiked 
                  ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                  : 'bg-white/80 text-gray-600 hover:bg-white'
              } backdrop-blur-sm`}
            >
              <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
            </Button>
          </div>
          {product.isSponsored && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-purple-600 text-white text-xs">Sponsored</Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Title and Score */}
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 flex-1">
              {product.name}
            </h3>
            <div className="ml-2 flex-shrink-0">
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${getEcoScoreColor(product.ecoScore)}`}>
                {product.ecoScore}
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-gray-600 text-sm mb-2 line-clamp-2">
            {product.description}
          </p>

          {/* Improvement Badge */}
          <div className="mb-3">
            <Badge className="bg-green-100 text-green-800 text-xs">
              <TrendingUp className="w-3 h-3 mr-1" />
              +{product.improvementScore} eco points better
            </Badge>
            <p className="text-xs text-gray-500 mt-1">
              vs. {product.basedOnProduct.name} ({product.basedOnProduct.ecoScore})
            </p>
          </div>

          {/* Price */}
          {product.price && (
            <div className="flex items-center space-x-2 mb-3">
              <span className="font-bold text-gray-900">{product.price}</span>
              {product.originalPrice && (
                <span className="text-sm text-gray-500 line-through">{product.originalPrice}</span>
              )}
            </div>
          )}

          {/* Certifications */}
          {product.certifications.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {product.certifications.slice(0, 2).map((cert) => (
                <Badge key={cert} variant="outline" className="text-xs bg-green-50 text-green-700">
                  {cert}
                </Badge>
              ))}
              {product.certifications.length > 2 && (
                <Badge variant="outline" className="text-xs text-gray-500">
                  +{product.certifications.length - 2}
                </Badge>
              )}
            </div>
          )}

          {/* Recommendation Reason */}
          <div className="bg-blue-50 rounded-lg p-2 mb-3">
            <p className="text-xs text-blue-700">
              <Sparkles className="inline w-3 h-3 mr-1" />
              {product.reasonForRecommendation}
            </p>
          </div>

          {/* Sustainability Highlights */}
          {product.sustainabilityHighlights.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-1">
                {product.sustainabilityHighlights.slice(0, 2).map((highlight, index) => (
                  <div key={index} className="flex items-center text-xs text-green-600">
                    <Leaf className="w-3 h-3 mr-1" />
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence Score */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>AI Confidence</span>
              <span>{product.confidence}%</span>
            </div>
            <Progress value={product.confidence} className="h-1" />
          </div>

          {/* Actions */}
          <div className="flex space-x-2">
            <Button onClick={onTrack} size="sm" className="flex-1 bg-teal-600 hover:bg-teal-700">
              <Plus className="mr-1 h-3 w-3" />
              Track
            </Button>
            {product.sourceUrl && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => window.open(product.sourceUrl, '_blank')}
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                View
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}