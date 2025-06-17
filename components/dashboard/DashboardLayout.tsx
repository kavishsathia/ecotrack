"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { UserMenu } from "@/components/auth/user-menu";
import { ProtectedRoute } from "@/components/auth/protected-route";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <main className="md:pl-64 min-h-screen">
          <div className="flex items-center justify-between p-4 md:hidden">
            <h1 className="text-xl font-semibold text-gray-900">Life</h1>
            <UserMenu />
          </div>
          <div className="hidden md:flex justify-end p-4">
            <UserMenu />
          </div>
          <div className="p-4 pt-0">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
