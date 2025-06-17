"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Package,
  Users,
  TrendingUp,
  AlertCircle,
  Calendar,
  Eye,
  EyeOff,
  Plus,
  Globe,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface DiscoverProduct {
  id: string;
  name: string;
  description: string;
  ecoScore: number;
  category: string;
  materials: string[];
  certifications: string[];
  scanCount: number;
  confidence: number;
  dateAdded: string;
  globalInsights: {
    sources: string[];
    scanCount: number;
    firstDiscovered: string;
    confidence: number;
  };
  recentTrackings: {
    id: string;
    name: string;
    userName: string;
    dateAdded: string;
  }[];
  trackingStats: {
    totalTrackings: number;
    recentTrackings: number;
  };
}

const getEcoScoreColor = (score: number) => {
  if (score >= 80) return "text-green-600 bg-green-50";
  if (score >= 60) return "text-blue-600 bg-blue-50";
  if (score >= 40) return "text-yellow-600 bg-yellow-50";
  return "text-red-600 bg-red-50";
};

const getEcoScoreLabel = (score: number) => {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function DiscoverPage() {
  const [products, setProducts] = useState<DiscoverProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState<
    "name" | "ecoScore" | "scanCount" | "dateAdded"
  >("scanCount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [categories, setCategories] = useState<string[]>([]);
  const [minEcoScore, setMinEcoScore] = useState<number | undefined>(undefined);
  const [maxEcoScore, setMaxEcoScore] = useState<number | undefined>(undefined);
  const [searchInput, setSearchInput] = useState("");
  const [actualSearch, setActualSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchProducts();
  }, [
    actualSearch,
    selectedCategory,
    sortBy,
    sortOrder,
    minEcoScore,
    maxEcoScore,
    currentPage,
  ]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * itemsPerPage;

      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        limit: itemsPerPage.toString(),
        offset: offset.toString(),
      });

      if (actualSearch) params.append("search", actualSearch);
      if (selectedCategory) params.append("category", selectedCategory);
      if (minEcoScore !== undefined)
        params.append("minEcoScore", minEcoScore.toString());
      if (maxEcoScore !== undefined)
        params.append("maxEcoScore", maxEcoScore.toString());

      const response = await fetch(`/api/products/discover?${params}`);
      const result = await response.json();

      if (result.success) {
        setProducts(result.data);
        setCategories(result.categories || []);
        setTotalProducts(result.pagination?.total || 0);
        setTotalPages(result.pagination?.totalPages || 1);
        setError(null);
      } else {
        setError(result.error || "Failed to fetch products");
      }
    } catch (err) {
      console.error("Error fetching products:", err);
      setError("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  const toggleSort = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActualSearch(searchInput);
    setCurrentPage(1); // Reset to first page on new search
  };

  const handleFilterChange = () => {
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleTrackProduct = (productId: string) => {
    // TODO: Implement tracking functionality
    console.log("Track product:", productId);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Discovering sustainable products...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Discover Products
            </h1>
            <p className="text-gray-600 mt-1">
              Explore sustainable products from the global catalog
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-teal-50 text-teal-700">
              <Globe className="mr-1 h-3 w-3" />
              {totalProducts} products found
            </Badge>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-4">
            <div className="space-y-3">
              {/* Search Bar */}
              <form onSubmit={handleSearchSubmit}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search products, materials, or certifications... (Press Enter to search)"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
              </form>

              {/* Filters Row */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Category Filter */}
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    Category:
                  </span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      handleFilterChange();
                    }}
                    className="text-sm border border-gray-300 rounded px-2 py-1.5 h-8"
                  >
                    <option value="">All Categories</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Eco Score Range */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">Eco Score:</span>
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minEcoScore || ""}
                    onChange={(e) => {
                      setMinEcoScore(
                        e.target.value ? parseInt(e.target.value) : undefined
                      );
                      handleFilterChange();
                    }}
                    className="w-16 text-sm h-8"
                    min="0"
                    max="100"
                  />
                  <span className="text-gray-400">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxEcoScore || ""}
                    onChange={(e) => {
                      setMaxEcoScore(
                        e.target.value ? parseInt(e.target.value) : undefined
                      );
                      handleFilterChange();
                    }}
                    className="w-16 text-sm h-8"
                    min="0"
                    max="100"
                  />
                </div>

                {/* Sort Controls */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">
                    Sort by:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(
                        e.target.value as
                          | "name"
                          | "ecoScore"
                          | "scanCount"
                          | "dateAdded"
                      );
                      handleFilterChange();
                    }}
                    className="text-sm border border-gray-300 rounded px-2 py-1.5 h-8"
                  >
                    <option value="scanCount">Popularity</option>
                    <option value="ecoScore">Eco Score</option>
                    <option value="name">Name</option>
                    <option value="dateAdded">Date Added</option>
                  </select>
                  <Button variant="ghost" size="sm" onClick={toggleSort}>
                    {sortOrder === "asc" ? (
                      <SortAsc className="h-4 w-4" />
                    ) : (
                      <SortDesc className="h-4 w-4" />
                    )}
                  </Button>
                </div>
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

        {/* Products Table */}
        {products.length === 0 && !loading ? (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No products found
              </h3>
              <p className="text-gray-600 mb-4">
                Try adjusting your search criteria or explore different
                categories
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ProductsTable
                products={products}
                onTrack={handleTrackProduct}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={(field) => {
                  if (field === sortBy) {
                    toggleSort();
                  } else {
                    setSortBy(field);
                    setSortOrder("desc");
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <PaginationComponent
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalProducts}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

interface ProductsTableProps {
  products: DiscoverProduct[];
  onTrack: (productId: string) => void;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (field: "name" | "ecoScore" | "scanCount" | "dateAdded") => void;
}

function ProductsTable({
  products,
  onTrack,
  sortBy,
  sortOrder,
  onSort,
}: ProductsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRowExpansion = (productId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedRows(newExpanded);
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return <SortAsc className="h-4 w-4 text-gray-400" />;
    return sortOrder === "asc" ? (
      <SortAsc className="h-4 w-4 text-gray-600" />
    ) : (
      <SortDesc className="h-4 w-4 text-gray-600" />
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left p-4 font-medium text-gray-900 w-8"></th>
            <th
              className="text-left p-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-100 min-w-[200px]"
              onClick={() => onSort("name")}
            >
              <div className="flex items-center space-x-2">
                <span>Product Name</span>
                {getSortIcon("name")}
              </div>
            </th>
            <th className="text-left p-4 font-medium text-gray-900 min-w-[120px]">
              Category
            </th>
            <th
              className="text-center p-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-100 min-w-[100px]"
              onClick={() => onSort("ecoScore")}
            >
              <div className="flex items-center justify-center space-x-2">
                <span>Eco Score</span>
                {getSortIcon("ecoScore")}
              </div>
            </th>
            <th
              className="text-center p-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-100 min-w-[100px]"
              onClick={() => onSort("scanCount")}
            >
              <div className="flex items-center justify-center space-x-2">
                <span>Scans</span>
                {getSortIcon("scanCount")}
              </div>
            </th>
            <th className="text-center p-4 font-medium text-gray-900 min-w-[120px]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {products.map((product) => (
            <React.Fragment key={product.id}>
              <tr className="hover:bg-gray-50">
                <td className="p-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRowExpansion(product.id)}
                    className="p-1 h-6 w-6"
                  >
                    {expandedRows.has(product.id) ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </Button>
                </td>
                <td className="p-4">
                  <div className="max-w-xs">
                    <div className="font-medium text-gray-900 truncate">
                      {product.name}
                    </div>
                    <div className="text-sm text-gray-500 line-clamp-2">
                      {product.description}
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <Badge variant="secondary" className="text-xs">
                    {product.category || "Uncategorized"}
                  </Badge>
                </td>
                <td className="p-4 text-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${getEcoScoreColor(
                        product.ecoScore
                      )}`}
                    >
                      {product.ecoScore}
                    </div>
                    <span className="text-xs text-gray-500 mt-1">
                      {getEcoScoreLabel(product.ecoScore)}
                    </span>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <Zap className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-gray-900">
                      {product.scanCount}
                    </span>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <Button
                    onClick={() => onTrack(product.id)}
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Track
                  </Button>
                </td>
              </tr>
              {expandedRows.has(product.id) && (
                <tr className="bg-gray-50">
                  <td></td>
                  <td colSpan={5} className="p-4">
                    <ProductDetails product={product} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ProductDetailsProps {
  product: DiscoverProduct;
}

function ProductDetails({ product }: ProductDetailsProps) {
  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-3 rounded-lg border">
          <div className="flex items-center space-x-2 mb-1">
            <Users className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-700">
              Total Trackings
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {product.trackingStats.totalTrackings}
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-gray-700">
              Data Confidence
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Progress value={product.confidence} className="flex-1 h-2" />
            <span className="text-sm font-bold text-gray-900">
              {product.confidence}%
            </span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border">
          <div className="flex items-center space-x-2 mb-1">
            <Calendar className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-700">
              Date Added
            </span>
          </div>
          <div className="text-sm font-medium text-gray-900">
            {formatDate(product.dateAdded)}
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border">
          <div className="flex items-center space-x-2 mb-1">
            <Globe className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-medium text-gray-700">
              First Discovered
            </span>
          </div>
          <div className="text-sm font-medium text-gray-900">
            {formatDate(product.globalInsights.firstDiscovered)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Materials */}
        {product.materials.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Materials</h4>
            <div className="flex flex-wrap gap-1">
              {product.materials.map((material) => (
                <Badge key={material} variant="outline" className="text-xs">
                  {material}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {product.certifications.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Certifications</h4>
            <div className="flex flex-wrap gap-1">
              {product.certifications.map((cert) => (
                <Badge
                  key={cert}
                  className="text-xs bg-green-100 text-green-800"
                >
                  {cert}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Sources Info */}
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Source Information</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Sources:</span>
              <span className="text-gray-900">
                {product.globalInsights.sources.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Global Scans:</span>
              <span className="text-gray-900">
                {product.globalInsights.scanCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Trackings */}
      {product.recentTrackings.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Recent Trackings</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {product.recentTrackings.map((tracking) => (
              <div
                key={tracking.id}
                className="bg-white p-3 rounded-lg border text-sm"
              >
                <div className="font-medium text-gray-900">
                  {tracking.name || tracking.userName}
                </div>
                <div className="text-gray-500">
                  {formatDate(tracking.dateAdded)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface PaginationComponentProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

function PaginationComponent({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginationComponentProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const showPages = 5; // Show 5 page numbers at most

    let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
    let endPage = Math.min(totalPages, startPage + showPages - 1);

    // Adjust start if we're near the end
    if (endPage - startPage + 1 < showPages) {
      startPage = Math.max(1, endPage - showPages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{startItem}</span> to{" "}
          <span className="font-medium">{endItem}</span> of{" "}
          <span className="font-medium">{totalItems}</span> results
        </div>

        <div className="flex items-center space-x-2">
          {/* Previous Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center space-x-1"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </Button>

          {/* Page Numbers */}
          <div className="flex items-center space-x-1">
            {currentPage > 3 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(1)}
                  className="w-8 h-8 p-0"
                >
                  1
                </Button>
                {currentPage > 4 && (
                  <span className="text-gray-500 px-1">...</span>
                )}
              </>
            )}

            {getPageNumbers().map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                className={`w-8 h-8 p-0 ${
                  page === currentPage
                    ? "bg-teal-600 text-white hover:bg-teal-700"
                    : ""
                }`}
              >
                {page}
              </Button>
            ))}

            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && (
                  <span className="text-gray-500 px-1">...</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(totalPages)}
                  className="w-8 h-8 p-0"
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>

          {/* Next Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center space-x-1"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
