'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BarChart3,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Home,
  Lightbulb,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
  Users,
  X,
} from 'lucide-react';

interface SidebarProps {
  className?: string;
}

const navigationItems = [
  {
    label: 'Overview',
    href: '/dashboard',
    icon: Home,
    description: 'Dashboard home with key metrics',
  },
  {
    label: 'My Products',
    href: '/dashboard/products',
    icon: Bookmark,
    description: 'Your tracked products',
    badge: 3, // Example badge count
  },
  {
    label: 'Discover',
    href: '/dashboard/discover',
    icon: Search,
    description: 'Explore product catalog',
  },
  {
    label: 'Recommendations',
    href: '/dashboard/recommendations',
    icon: Lightbulb,
    description: 'AI-powered suggestions',
    badge: 5, // Example badge count
  },
  {
    label: 'Logs',
    href: '/dashboard/logs',
    icon: BarChart3,
    description: 'Activity logs and events',
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    description: 'Profile and preferences',
  },
];

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobile = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const getInitials = (name: string | null, email: string | undefined) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={toggleMobile}
      >
        {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-200 transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          className
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
            {!isCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
                  <EcoTrackIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">EcoTrack</h1>
                  <p className="text-xs text-gray-500">Sustainability Platform</p>
                </div>
              </div>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex h-8 w-8"
              onClick={toggleCollapse}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-4">
            <nav className="space-y-1 px-2">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link key={item.href} href={item.href} onClick={() => setIsMobileOpen(false)}>
                    <Button
                      variant={isActive ? 'default' : 'ghost'}
                      className={cn(
                        'w-full justify-start h-11',
                        isActive
                          ? 'bg-teal-600 text-white hover:bg-teal-700'
                          : 'text-gray-700 hover:bg-gray-100',
                        isCollapsed && 'px-2'
                      )}
                    >
                      <Icon className={cn('h-5 w-5', !isCollapsed && 'mr-3')} />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <Badge
                              variant={isActive ? 'secondary' : 'default'}
                              className={cn(
                                'ml-2',
                                isActive
                                  ? 'bg-teal-100 text-teal-800'
                                  : 'bg-teal-100 text-teal-800'
                              )}
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </>
                      )}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Profile Section */}
          <div className="border-t border-gray-200 p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start h-11 hover:bg-gray-100',
                    isCollapsed && 'px-2'
                  )}
                >
                  <Avatar className={cn('h-8 w-8', !isCollapsed && 'mr-3')}>
                    <AvatarImage src="" alt={user?.name || user?.email || 'User'} />
                    <AvatarFallback className="bg-teal-100 text-teal-700">
                      {getInitials(user?.name, user?.email)}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-gray-900">
                        {user?.name || 'User'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user?.singpassId ? 'Singpass verified' : user?.email}
                      </p>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={() => logout()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content spacer */}
      <div
        className={cn(
          'transition-all duration-300 md:block hidden',
          isCollapsed ? 'ml-16' : 'ml-64'
        )}
      />
    </>
  );
}

// EcoTrack icon component
function EcoTrackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M3 13h8V3H9v6H5V3H3v10zm0 8h8v-6H9v4H5v-4H3v6zm8 0h8V11h-2v8h-4v-8h-2v10zm0-12h8V3h-2v6h-4V3h-2v6z"/>
    </svg>
  );
}