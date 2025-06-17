'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Calendar,
  Filter,
  Search,
  Clock,
  TrendingUp,
  Package,
  Zap,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  Activity,
  Star,
  Eye,
  EyeOff,
} from 'lucide-react';
import { getStepTypeInfo, getCategoryForStepType, STEP_TYPE_CATEGORIES } from '@/lib/lifecycle-types';

interface LifecycleStep {
  id: string;
  stepType: string;
  title: string;
  description: string;
  createdAt: string;
  priority: number;
  sourceType: string;
  metadata: any;
  ecoScoreBefore: number | null;
  ecoScoreAfter: number | null;
  priceBefore: number | null;
  priceAfter: number | null;
  product: {
    id: string;
    canonicalName: string;
    ecoScore: number | null;
    category: string | null;
  };
  tracking: {
    id: string;
    trackingName: string | null;
  };
}

interface Product {
  id: string;
  canonicalName: string;
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatTimeAgo = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return formatDate(dateString);
};

const getStepIcon = (stepType: string) => {
  const stepInfo = getStepTypeInfo(stepType);
  return <span className="text-base">{stepInfo.icon}</span>;
};

const getStepColor = (stepType: string) => {
  const stepInfo = getStepTypeInfo(stepType);
  return stepInfo.color || 'text-gray-600';
};

const getStepTypeLabel = (stepType: string) => {
  const stepInfo = getStepTypeInfo(stepType);
  return stepInfo.label;
};

const getEcoScoreChange = (before: number | null, after: number | null) => {
  if (before === null || after === null) return null;
  return after - before;
};

export default function LogsPage() {
  const [steps, setSteps] = useState<LifecycleStep[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSteps, setTotalSteps] = useState(0);
  const [filters, setFilters] = useState({
    search: '',
    productId: '',
    stepCategory: '',
    sourceType: '',
    dateRange: '',
  });

  useEffect(() => {
    fetchProducts();
    fetchSteps();
  }, [page, filters]);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products/my-products?limit=100');
      const result = await response.json();

      if (result.success) {
        setProducts(result.data.map((item: any) => ({
          id: item.productId,
          canonicalName: item.name,
        })));
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchSteps = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '')),
      });

      const response = await fetch(`/api/lifecycle/steps?${params}`);
      const result = await response.json();

      if (result.success) {
        setSteps(result.data);
        setTotalPages(result.pagination.totalPages);
        setTotalSteps(result.pagination.total);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch lifecycle steps');
      }
    } catch (err) {
      console.error('Error fetching steps:', err);
      setError('Failed to fetch lifecycle steps');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filtering
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  if (loading && steps.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading activity logs...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Activity Logs</h1>
            <p className="text-gray-600 mt-1">
              View all product lifecycle events and system activities
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="bg-purple-50 text-purple-700">
              <Activity className="mr-1 h-3 w-3" />
              {totalSteps} events
            </Badge>
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Export Timeline
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Activity Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search events..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Product Filter */}
              <select
                value={filters.productId}
                onChange={(e) => handleFilterChange('productId', e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option key="all-products" value="">All Products</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.canonicalName}
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={filters.stepCategory}
                onChange={(e) => handleFilterChange('stepCategory', e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option key="all-categories" value="">All Categories</option>
                {Object.entries(STEP_TYPE_CATEGORIES).map(([category, _]) => (
                  <option key={category} value={category}>
                    {category.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>

              {/* Source Type Filter */}
              <select
                value={filters.sourceType}
                onChange={(e) => handleFilterChange('sourceType', e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option key="all-sources" value="">All Sources</option>
                <option key="telegram_bot" value="telegram_bot">Telegram Bot</option>
                <option key="system" value="system">System Generated</option>
                <option key="api" value="api">API</option>
                <option key="manual" value="manual">Manual</option>
                <option key="extension" value="extension">Browser Extension</option>
              </select>

              {/* Date Range Filter */}
              <select
                value={filters.dateRange}
                onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option key="all-time" value="">All Time</option>
                <option key="today" value="today">Today</option>
                <option key="week" value="week">Past Week</option>
                <option key="month" value="month">Past Month</option>
                <option key="quarter" value="quarter">Past Quarter</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Timeline */}
        {steps.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No activity found</h3>
            <p className="text-gray-600">Try adjusting your filters or track some products to see activity.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {steps.map((step) => {
              const ecoScoreChange = getEcoScoreChange(step.ecoScoreBefore, step.ecoScoreAfter);
              const stepInfo = getStepTypeInfo(step.stepType);
              
              return (
                <Card key={step.id} className="border-l-4" style={{ borderLeftColor: stepInfo.color || '#6B7280' }}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        {/* Icon */}
                        <div className="flex-shrink-0 mt-1">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                            style={{ backgroundColor: stepInfo.color || '#6B7280' }}
                          >
                            {getStepIcon(step.stepType)}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                            <Badge variant="outline" className="text-xs">
                              {getStepTypeLabel(step.stepType)}
                            </Badge>
                          </div>
                          
                          <p className="text-gray-600 mb-2">{step.description}</p>
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Package className="mr-1 h-4 w-4" />
                              {step.product.canonicalName}
                            </span>
                            <span className="flex items-center">
                              <Clock className="mr-1 h-4 w-4" />
                              {formatTimeAgo(step.createdAt)}
                            </span>
                            <span className="flex items-center">
                              <Activity className="mr-1 h-4 w-4" />
                              {step.sourceType.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>

                          {/* Eco Score Change */}
                          {ecoScoreChange !== null && (
                            <div className="mt-3">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-600">Eco Score Impact:</span>
                                <div className={`flex items-center space-x-1 ${
                                  ecoScoreChange > 0 ? 'text-green-600' : ecoScoreChange < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {ecoScoreChange > 0 ? (
                                    <TrendingUp className="h-4 w-4" />
                                  ) : ecoScoreChange < 0 ? (
                                    <TrendingDown className="h-4 w-4" />
                                  ) : null}
                                  <span className="font-medium">
                                    {ecoScoreChange > 0 ? '+' : ''}{ecoScoreChange} points
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    ({step.ecoScoreBefore} → {step.ecoScoreAfter})
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Priority Indicator */}
                      <div className="flex-shrink-0 ml-4">
                        <div className="flex items-center space-x-2">
                          {step.priority >= 8 && (
                            <Star className="h-4 w-4 text-yellow-500" />
                          )}
                          <span className="text-xs text-gray-500">
                            {formatDate(step.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing page {page} of {totalPages} ({totalSteps} total events)
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}