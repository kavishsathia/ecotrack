'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plus,
  Filter,
  SortAsc,
  SortDesc,
  Leaf,
  Package,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ExternalLink,
  Calendar,
  BarChart3,
  Star,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react';
import { getStepTypeInfo, getCategoryForStepType } from '@/lib/lifecycle-types';

interface TrackedProduct {
  trackingId: string;
  productId: string;
  name: string;
  description: string;
  ecoScore: number;
  category: string;
  materials: string[];
  certifications: string[];
  scanCount: number;
  confidence: number;
  imageUrl?: string;
  trackingName?: string;
  notes?: string;
  sourceUrl?: string;
  dateAdded: string;
  lastUpdate: string;
  alerts: {
    price: boolean;
    stock: boolean;
    sustainability: boolean;
  };
  lifecycleSteps: LifecycleStep[];
  lifecycleSummary: {
    totalSteps: number;
    lastActivity: string;
    majorEvents: number;
    improvements: number;
  };
  globalInsights: {
    sources: string[];
    scanCount: number;
    firstDiscovered: string;
    confidence: number;
  };
  summaryStats?: {
    summariesGenerated: number;
    totalStepsProcessed: number;
    pendingSteps: number;
    latestSummaryDate?: string;
    overallEcoScoreChange?: number;
  };
}

interface LifecycleStep {
  id: string;
  stepType: string;
  title: string;
  description?: string;
  metadata?: any;
  ecoScoreBefore?: number;
  ecoScoreAfter?: number;
  priceBefore?: number;
  priceAfter?: number;
  sourceUrl?: string;
  sourceType: string;
  priority: number;
  createdAt: string;
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

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function MyProductsPage() {
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'ecoScore' | 'dateAdded' | 'lastUpdate'>('dateAdded');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [includeInactive, setIncludeInactive] = useState(false);

  useEffect(() => {
    fetchMyProducts();
  }, [sortBy, sortOrder, includeInactive]);

  const fetchMyProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        includeInactive: includeInactive.toString(),
        limit: '50',
      });

      const response = await fetch(`/api/products/my-products?${params}`);
      const result = await response.json();

      if (result.success) {
        setProducts(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch products');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to fetch tracked products');
    } finally {
      setLoading(false);
    }
  };

  const toggleSort = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your tracked products...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">My Products</h1>
            <p className="text-gray-600 mt-1">
              Track and manage your sustainable product journey
            </p>
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Plus className="mr-2 h-4 w-4" />
            Track New Product
          </Button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="dateAdded">Date Added</option>
                <option value="lastUpdate">Last Update</option>
                <option value="name">Name</option>
                <option value="ecoScore">Eco Score</option>
              </select>
              <Button variant="ghost" size="sm" onClick={toggleSort}>
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={includeInactive}
                onCheckedChange={setIncludeInactive}
                id="include-inactive"
              />
              <label htmlFor="include-inactive" className="text-sm text-gray-700">
                Include inactive
              </label>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            {products.length} product{products.length !== 1 ? 's' : ''} tracked
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

        {/* Products List */}
        {products.length === 0 && !loading ? (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products tracked yet</h3>
              <p className="text-gray-600 mb-4">
                Start tracking products to monitor their sustainability journey
              </p>
              <Button className="bg-teal-600 hover:bg-teal-700">
                <Plus className="mr-2 h-4 w-4" />
                Track Your First Product
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {products.map((product) => (
              <ProductCard key={product.trackingId} product={product} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

interface ProductCardProps {
  product: TrackedProduct;
}

function ProductCard({ product }: ProductCardProps) {
  const [showLifecycle, setShowLifecycle] = useState(false);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          {/* Product Image */}
          {product.imageUrl && (
            <div className="flex-shrink-0 mr-4">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-16 h-16 object-cover rounded-lg border"
              />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg mb-1 truncate">
              {product.trackingName || product.name}
            </CardTitle>
            <CardDescription className="line-clamp-2">
              {product.description}
            </CardDescription>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {product.category || 'Uncategorized'}
              </Badge>
              {product.certifications.slice(0, 2).map((cert) => (
                <Badge key={cert} className="text-xs bg-green-100 text-green-800">
                  {cert}
                </Badge>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-3 ml-4">
            {/* Eco Score */}
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full text-lg font-bold ${getEcoScoreColor(product.ecoScore)}`}>
                {product.ecoScore}
              </div>
              <p className="text-xs text-gray-500 mt-1">{getEcoScoreLabel(product.ecoScore)}</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">Tracked Since</div>
            <div className="font-medium text-gray-900">{formatDate(product.dateAdded)}</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">Lifecycle Steps</div>
            <div className="font-medium text-gray-900">{product.lifecycleSummary.totalSteps}</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">Improvements</div>
            <div className="font-medium text-green-600">{product.lifecycleSummary.improvements}</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">Global Scans</div>
            <div className="font-medium text-gray-900">{product.globalInsights.scanCount}</div>
          </div>
        </div>

        {/* Alert Preferences */}
        <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm font-medium text-blue-900">Active Alerts:</div>
          <div className="flex items-center space-x-4">
            {product.alerts.price && <Badge className="bg-blue-100 text-blue-800 text-xs">Price</Badge>}
            {product.alerts.stock && <Badge className="bg-blue-100 text-blue-800 text-xs">Stock</Badge>}
            {product.alerts.sustainability && <Badge className="bg-blue-100 text-blue-800 text-xs">Sustainability</Badge>}
            {!product.alerts.price && !product.alerts.stock && !product.alerts.sustainability && (
              <span className="text-sm text-gray-500">None</span>
            )}
          </div>
        </div>

        {/* AI Summary Stats */}
        {product.summaryStats && product.summaryStats.summariesGenerated > 0 && (
          <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center space-x-2 mb-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">AI Lifecycle Summary</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-purple-700 font-medium">{product.summaryStats.summariesGenerated}</span>
                <span className="text-purple-600"> summaries generated</span>
              </div>
              <div>
                <span className="text-purple-700 font-medium">{product.summaryStats.totalStepsProcessed}</span>
                <span className="text-purple-600"> steps processed</span>
              </div>
              {product.summaryStats.pendingSteps > 0 && (
                <div>
                  <span className="text-orange-700 font-medium">{product.summaryStats.pendingSteps}</span>
                  <span className="text-orange-600"> steps pending</span>
                </div>
              )}
              {product.summaryStats.overallEcoScoreChange && (
                <div>
                  <span className={`font-medium ${product.summaryStats.overallEcoScoreChange > 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {product.summaryStats.overallEcoScoreChange > 0 ? '+' : ''}{product.summaryStats.overallEcoScoreChange}
                  </span>
                  <span className="text-purple-600"> eco change</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLifecycle(!showLifecycle)}
            >
              {showLifecycle ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showLifecycle ? 'Hide' : 'View'} Lifecycle
            </Button>
            {product.summaryStats && product.summaryStats.summariesGenerated > 0 && (
              <Button variant="outline" size="sm" className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100">
                <BarChart3 className="mr-2 h-4 w-4" />
                View AI Summary
              </Button>
            )}
            {product.sourceUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Product
                </a>
              </Button>
            )}
          </div>
          
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {/* Lifecycle Timeline */}
        {showLifecycle && (
          <div className="mt-6 pt-4 border-t">
            <LifecycleTimeline steps={product.lifecycleSteps} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface LifecycleTimelineProps {
  steps: LifecycleStep[];
}

function LifecycleTimeline({ steps }: LifecycleTimelineProps) {
  if (steps.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock className="mx-auto h-8 w-8 mb-2" />
        <p>No lifecycle events recorded yet</p>
      </div>
    );
  }

  const getStepIcon = (stepType: string) => {
    const stepInfo = getStepTypeInfo(stepType);
    return <span className="text-base">{stepInfo.icon}</span>;
  };

  const getStepColor = (stepType: string) => {
    const stepInfo = getStepTypeInfo(stepType);
    switch (stepInfo.color) {
      case 'green':
        return 'border-green-200 bg-green-50';
      case 'red':
        return 'border-red-200 bg-red-50';
      case 'blue':
        return 'border-blue-200 bg-blue-50';
      case 'orange':
        return 'border-orange-200 bg-orange-50';
      case 'purple':
        return 'border-purple-200 bg-purple-50';
      case 'yellow':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900 mb-4">Product Lifecycle</h4>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.id} className={`p-4 rounded-lg border ${getStepColor(step.stepType)}`}>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {getStepIcon(step.stepType)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h5 className="text-sm font-medium text-gray-900">{step.title}</h5>
                    <Badge variant="outline" className="text-xs">
                      {getStepTypeInfo(step.stepType).label}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={`text-xs ${
                      step.sourceType === 'telegram_bot' ? 'bg-purple-100 text-purple-800' :
                      step.sourceType === 'system' ? 'bg-gray-100 text-gray-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {step.sourceType === 'telegram_bot' ? 'Telegram' : 
                       step.sourceType === 'system' ? 'System' : 
                       step.sourceType}
                    </Badge>
                    <span className="text-xs text-gray-500">{formatDate(step.createdAt)}</span>
                  </div>
                </div>
                {step.description && (
                  <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                )}
                
                {/* Metrics */}
                <div className="mt-2 space-y-2">
                  {(step.ecoScoreBefore !== null && step.ecoScoreAfter !== null) && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">Eco Score:</span>
                      <Badge variant="outline" className="text-xs">
                        {step.ecoScoreBefore} → {step.ecoScoreAfter}
                      </Badge>
                      {step.ecoScoreAfter > step.ecoScoreBefore ? (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-600" />
                      )}
                    </div>
                  )}
                  
                  {(step.priceBefore !== null && step.priceAfter !== null) && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">Price:</span>
                      <Badge variant="outline" className="text-xs">
                        ${step.priceBefore} → ${step.priceAfter}
                      </Badge>
                    </div>
                  )}
                  
                  {/* Telegram Bot Metadata */}
                  {step.metadata?.source === 'telegram_bot' && (
                    <div className="bg-purple-50 rounded p-2 mt-2">
                      <div className="text-xs text-purple-800 space-y-1">
                        {step.metadata.originalText && (
                          <div>
                            <span className="font-medium">Original message:</span> "{step.metadata.originalText}"
                          </div>
                        )}
                        {step.metadata.productMatch && (
                          <div>
                            <span className="font-medium">Match confidence:</span> {step.metadata.productMatch.confidence}%
                            <span className="text-purple-600 ml-1">({step.metadata.productMatch.reason})</span>
                          </div>
                        )}
                        {step.metadata.telegramId && (
                          <div>
                            <span className="font-medium">Telegram User:</span> {step.metadata.telegramId}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Priority indicator */}
                  {step.priority >= 8 && (
                    <div className="flex items-center space-x-1">
                      <Star className="h-3 w-3 text-yellow-500 fill-current" />
                      <span className="text-xs text-gray-500">High Priority Event</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}