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

interface LifecycleFilters {
  productId: string;
  stepCategory: string;
  sourceType: string;
  dateRange: string;
  search: string;
}

export default function LifecyclePage() {
  const [steps, setSteps] = useState<LifecycleStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LifecycleFilters>({
    productId: '',
    stepCategory: '',
    sourceType: '',
    dateRange: '',
    search: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSteps, setTotalSteps] = useState(0);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<any[]>([]);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchLifecycleSteps();
    fetchProducts();
  }, [filters, currentPage]);

  const fetchLifecycleSteps = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * itemsPerPage;
      
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: offset.toString(),
      });

      if (filters.productId) params.append('productId', filters.productId);
      if (filters.stepCategory) params.append('stepCategory', filters.stepCategory);
      if (filters.sourceType) params.append('sourceType', filters.sourceType);
      if (filters.dateRange) params.append('dateRange', filters.dateRange);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`/api/lifecycle/steps?${params}`);
      const result = await response.json();

      if (result.success) {
        setSteps(result.data);
        setTotalSteps(result.pagination?.total || 0);
        setTotalPages(result.pagination?.totalPages || 1);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch lifecycle steps');
      }
    } catch (err) {
      console.error('Error fetching lifecycle steps:', err);
      setError('Failed to fetch lifecycle steps');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products/my-products');
      const result = await response.json();
      if (result.success) {
        setProducts(result.data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const handleFilterChange = (key: keyof LifecycleFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const toggleStepExpansion = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSourceTypeLabel = (sourceType: string) => {
    const labels: Record<string, string> = {
      'api': 'API',
      'system': 'System',
      'telegram_bot': 'Telegram Bot',
      'manual': 'Manual',
      'extension': 'Browser Extension',
    };
    return labels[sourceType] || sourceType;
  };

  const getSourceTypeColor = (sourceType: string) => {
    const colors: Record<string, string> = {
      'api': 'bg-blue-100 text-blue-800',
      'system': 'bg-gray-100 text-gray-800',
      'telegram_bot': 'bg-purple-100 text-purple-800',
      'manual': 'bg-green-100 text-green-800',
      'extension': 'bg-orange-100 text-orange-800',
    };
    return colors[sourceType] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading lifecycle timeline...</p>
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
          <Card className="text-center py-12">
            <CardContent>
              <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No lifecycle events found
              </h3>
              <p className="text-gray-600 mb-4">
                Start tracking products or adjust your filters to see lifecycle events
              </p>
              <Button variant="outline">
                <Package className="mr-2 h-4 w-4" />
                Track Your First Product
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {steps.map((step, index) => {
              const stepInfo = getStepTypeInfo(step.stepType);
              const isExpanded = expandedSteps.has(step.id);
              const isFirstOfDay = index === 0 || 
                new Date(step.createdAt).toDateString() !== new Date(steps[index - 1].createdAt).toDateString();

              return (
                <div key={step.id}>
                  {/* Date Separator */}
                  {isFirstOfDay && (
                    <div className="flex items-center my-6">
                      <div className="flex-1 border-t border-gray-200"></div>
                      <div className="px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-600">
                        {new Date(step.createdAt).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="flex-1 border-t border-gray-200"></div>
                    </div>
                  )}

                  {/* Timeline Item */}
                  <Card className="hover:shadow-md transition-shadow duration-200">
                    <CardContent className="p-0">
                      <div className="flex items-start space-x-4 p-6">
                        {/* Timeline Icon */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                          stepInfo.color === 'green' ? 'bg-green-100 text-green-600' :
                          stepInfo.color === 'red' ? 'bg-red-100 text-red-600' :
                          stepInfo.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                          stepInfo.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                          stepInfo.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {stepInfo.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{step.title}</h3>
                              <p className="text-sm text-gray-600 mt-1">
                                {step.product.canonicalName}
                                {step.tracking.trackingName && (
                                  <span className="text-gray-400"> • {step.tracking.trackingName}</span>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <Badge className={getSourceTypeColor(step.sourceType)}>
                                {getSourceTypeLabel(step.sourceType)}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleStepExpansion(step.id)}
                                className="p-1 h-6 w-6"
                              >
                                {isExpanded ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-gray-700 mt-2">{step.description}</p>

                          {/* Metrics */}
                          {(step.ecoScoreBefore !== null || step.priceBefore !== null) && (
                            <div className="flex items-center space-x-4 mt-3">
                              {step.ecoScoreBefore !== null && step.ecoScoreAfter !== null && (
                                <div className="flex items-center space-x-2">
                                  <Zap className="h-4 w-4 text-green-500" />
                                  <span className="text-sm">
                                    Eco Score: {step.ecoScoreBefore} → {step.ecoScoreAfter}
                                    <span className={`ml-1 ${
                                      step.ecoScoreAfter > step.ecoScoreBefore ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      ({step.ecoScoreAfter > step.ecoScoreBefore ? '+' : ''}{step.ecoScoreAfter - step.ecoScoreBefore})
                                    </span>
                                  </span>
                                </div>
                              )}
                              {step.priceBefore !== null && step.priceAfter !== null && (
                                <div className="flex items-center space-x-2">
                                  <TrendingUp className="h-4 w-4 text-blue-500" />
                                  <span className="text-sm">
                                    Price: ${step.priceBefore} → ${step.priceAfter}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Timestamp */}
                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                              <Clock className="h-3 w-3" />
                              <span>{formatDate(step.createdAt)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Star className={`h-3 w-3 ${
                                step.priority >= 8 ? 'text-yellow-500 fill-current' : 'text-gray-300'
                              }`} />
                              <span className="text-xs text-gray-500">Priority: {step.priority}</span>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && step.metadata && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                              <h4 className="font-medium text-gray-900 mb-2">Event Details</h4>
                              <div className="space-y-2 text-sm">
                                {step.metadata.source && (
                                  <div>
                                    <span className="font-medium">Source:</span> {step.metadata.source}
                                  </div>
                                )}
                                {step.metadata.telegramId && (
                                  <div>
                                    <span className="font-medium">Telegram User:</span> {step.metadata.telegramId}
                                  </div>
                                )}
                                {step.metadata.productMatch && (
                                  <div>
                                    <span className="font-medium">Match Confidence:</span> {step.metadata.productMatch.confidence}%
                                    <span className="text-gray-500 ml-2">({step.metadata.productMatch.reason})</span>
                                  </div>
                                )}
                                {step.metadata.originalText && (
                                  <div>
                                    <span className="font-medium">Original Text:</span> "{step.metadata.originalText}"
                                  </div>
                                )}
                                {step.metadata.confidence && (
                                  <div>
                                    <span className="font-medium">AI Confidence:</span> {step.metadata.confidence}%
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalSteps)} of {totalSteps} events
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}