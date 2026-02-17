import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { CreatorSidebar } from "./creator-sidebar";
import { AdminSidebar } from "./admin-sidebar";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { RefreshProgressBar } from "@/components/refresh-progress-bar";
import { AdminRefreshProgressBar } from "@/components/admin-refresh-progress-bar";
import { PayoutSyncProgressBar } from "@/components/payout-sync-progress-bar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const isAdmin = user?.role === "admin";
  const isCreatorOverview = location === "/creator" || location === "/creator/videos" || location === "/creator/dashboard" || location === "/creator/creator-hub";

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider defaultOpen={false} style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        {isAdmin ? <AdminSidebar /> : <CreatorSidebar />}
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          {!isAdmin && !isCreatorOverview && <RefreshProgressBar />}
          {isAdmin && <AdminRefreshProgressBar />}
          {isAdmin && <PayoutSyncProgressBar />}
          <main className="flex-1 overflow-auto p-6 text-[16px] font-semibold">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
