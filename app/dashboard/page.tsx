'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BarChart3,
  Leaf,
  Package,
  TrendingUp,
  TrendingDown,
  Users,
  Zap,
  AlertCircle,
  Activity,
  Target,
  Clock,
} from 'lucide-react';

interface DashboardStats {
  trackedProductsCount: number;
  averageEcoScore: number;
  totalLifecycleSteps: number;
  improvementsCount: number;
  recommendationsCount: number;
  recentActivity: ActivityItem[];
  topCategories: { category: string; count: number }[];
  ecoScoreDistribution: { range: string; label: string; count: number; color: string }[];
}

interface ActivityItem {
  id: string;
  stepType: string;
  title: string;
  description?: string;
  ecoScoreBefore?: number;
  ecoScoreAfter?: number;
  sourceType: string;
  createdAt: string;
  productName: string;
  productImage?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/stats');
      const result = await response.json();

      if (result.success) {
        setStats(result.stats);
        setIsGuest(result.isGuest);
        setError(null);
      } else {
        setError(result.error || 'Failed to load dashboard stats');
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const getEcoScoreColor = (score: number) => {
    if (score >= 80) return { text: 'text-green-600', bg: 'bg-green-50' };
    if (score >= 60) return { text: 'text-blue-600', bg: 'bg-blue-50' };
    if (score >= 40) return { text: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { text: 'text-red-600', bg: 'bg-red-50' };
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your dashboard...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              {isGuest ? 'Welcome! Sign in to track your sustainability journey.' : 'Welcome back! Here\'s your sustainability overview.'}
            </p>
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Package className="mr-2 h-4 w-4" />
            Scan New Product
          </Button>
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

        {/* Guest Message */}
        {isGuest && (
          <Alert className="border-blue-200 bg-blue-50">
            <Activity className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Sign in to start tracking products and see your personalized sustainability stats.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Average Eco Score"
              value={stats.averageEcoScore > 0 ? stats.averageEcoScore.toString() : '--'}
              subtitle={stats.trackedProductsCount > 0 ? `${stats.trackedProductsCount} products tracked` : 'No products yet'}
              icon={Leaf}
              iconColor={getEcoScoreColor(stats.averageEcoScore).text}
              bgColor={getEcoScoreColor(stats.averageEcoScore).bg}
              trend={stats.averageEcoScore >= 70 ? 'up' : undefined}
            />
            <StatCard
              title="Products Tracked"
              value={stats.trackedProductsCount.toString()}
              subtitle={`${stats.totalLifecycleSteps} lifecycle events`}
              icon={Package}
              iconColor="text-blue-600"
              bgColor="bg-blue-50"
              badge={stats.improvementsCount > 0 ? stats.improvementsCount.toString() : undefined}
            />
            <StatCard
              title="Better Alternatives"
              value={stats.recommendationsCount.toString()}
              subtitle="Available recommendations"
              icon={Zap}
              iconColor="text-yellow-600"
              bgColor="bg-yellow-50"
            />
            <StatCard
              title="Improvements"
              value={stats.improvementsCount.toString()}
              subtitle="Eco score upgrades"
              icon={TrendingUp}
              iconColor="text-green-600"
              bgColor="bg-green-50"
              trend="up"
            />
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <Package className="h-6 w-6 mb-2" />
              <span>Scan Product</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <Zap className="h-6 w-6 mb-2" />
              <span>View Recommendations</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <BarChart3 className="h-6 w-6 mb-2" />
              <span>View Analytics</span>
            </Button>
          </div>
        </div>

        {/* Recent Activity */}
        {stats && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
            {stats.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {stats.recentActivity.map((activity) => (
                  <RealActivityItem
                    key={activity.id}
                    activity={activity}
                    formatTimeAgo={formatTimeAgo}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock className="mx-auto h-8 w-8 mb-2" />
                <p>No recent activity yet</p>
                <p className="text-sm">Start tracking products to see your activity here</p>
              </div>
            )}
          </div>
        )}

        {/* Eco Score Distribution */}
        {stats && stats.ecoScoreDistribution.some(d => d.count > 0) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Products by Eco Score</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.ecoScoreDistribution.map((dist) => (
                <div key={dist.range} className="text-center">
                  <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl font-bold ${
                    dist.color === 'green' ? 'bg-green-100 text-green-700' :
                    dist.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                    dist.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {dist.count}
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-2">{dist.label}</p>
                  <p className="text-xs text-gray-500">{dist.range}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Categories */}
        {stats && stats.topCategories.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Top Categories</h2>
            <div className="space-y-3">
              {stats.topCategories.map((category, index) => (
                <div key={category.category} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="font-medium text-gray-900">{category.category}</span>
                  </div>
                  <Badge className="bg-teal-100 text-teal-800">
                    {category.count} product{category.count !== 1 ? 's' : ''}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
  trend?: 'up' | 'down';
  badge?: string;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  bgColor,
  trend,
  badge,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        {badge && (
          <Badge className="bg-teal-100 text-teal-800">
            {badge}
          </Badge>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        <p className="text-sm text-gray-600 mt-1">{title}</p>
        <div className="flex items-center mt-2">
          {trend && (
            <TrendingUp className={`h-4 w-4 mr-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`} />
          )}
          <span className="text-sm text-gray-500">{subtitle}</span>
        </div>
      </div>
    </div>
  );
}

interface RealActivityItemProps {
  activity: ActivityItem;
  formatTimeAgo: (dateString: string) => string;
}

function RealActivityItem({ activity, formatTimeAgo }: RealActivityItemProps) {
  const getStepIcon = (stepType: string) => {
    switch (stepType) {
      case 'tracked':
        return <Package className="h-5 w-5 text-blue-600" />;
      case 'improvement':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'disposed':
        return <Target className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-teal-600" />;
    }
  };

  const getStepColor = (stepType: string) => {
    switch (stepType) {
      case 'tracked':
        return 'bg-blue-100';
      case 'improvement':
        return 'bg-green-100';
      case 'disposed':
        return 'bg-red-100';
      default:
        return 'bg-teal-100';
    }
  };

  const formatAction = (stepType: string, sourceType: string) => {
    if (stepType === 'tracked') return 'Tracked product';
    if (stepType === 'improvement') return 'Eco improvement';
    if (sourceType === 'telegram_bot') return 'Telegram update';
    return activity.title || 'Activity';
  };

  return (
    <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
      <div className="flex items-center space-x-3">
        {activity.productImage && (
          <img
            src={activity.productImage}
            alt={activity.productName}
            className="w-10 h-10 object-cover rounded-lg"
          />
        )}
        <div className={`w-10 h-10 ${getStepColor(activity.stepType)} rounded-full flex items-center justify-center ${activity.productImage ? 'ml-2' : ''}`}>
          {getStepIcon(activity.stepType)}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">
            {formatAction(activity.stepType, activity.sourceType)}
          </p>
          <p className="text-sm text-gray-600">{activity.productName}</p>
          {activity.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{activity.description}</p>
          )}
        </div>
      </div>
      <div className="text-right">
        {activity.ecoScoreAfter && (
          <Badge className="bg-green-100 text-green-800 mb-1">
            {activity.ecoScoreAfter}
          </Badge>
        )}
        {activity.ecoScoreBefore && activity.ecoScoreAfter && activity.ecoScoreAfter > activity.ecoScoreBefore && (
          <Badge className="bg-blue-100 text-blue-800 mb-1 ml-1">
            +{activity.ecoScoreAfter - activity.ecoScoreBefore}
          </Badge>
        )}
        <p className="text-xs text-gray-500">{formatTimeAgo(activity.createdAt)}</p>
      </div>
    </div>
  );
}