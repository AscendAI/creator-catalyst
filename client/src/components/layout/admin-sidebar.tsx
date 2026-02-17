import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Users, DollarSign, LogOut, Settings, MessageSquare, X, FileText, PlayCircle, LayoutDashboard, LucideIcon } from "lucide-react";

const AnimatedIcon = ({ isHovered, iconType }: { isHovered: boolean; iconType: string }) => {
  const baseClass = "w-5 h-5 transition-all duration-300";
  
  switch (iconType) {
    case 'dashboard':
      return (
        <div className={`relative ${baseClass}`}>
          <LayoutDashboard className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-sky-500 animate-pulse' : ''}`} />
        </div>
      );
    case 'play':
      return (
        <div className={`relative ${baseClass}`}>
          <PlayCircle className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-red-500 animate-play-pulse' : ''}`} />
        </div>
      );
    case 'file':
      return (
        <div className={`relative ${baseClass}`}>
          <FileText className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-orange-500 animate-book-flip' : ''}`} />
        </div>
      );
    case 'users':
      return (
        <div className={`relative ${baseClass}`}>
          <Users className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-cyan-500 animate-users-gather' : ''}`} />
        </div>
      );
    case 'dollar':
      return (
        <div className={`relative ${baseClass}`}>
          <DollarSign className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-blue-500 animate-wallet-open' : ''}`} />
        </div>
      );
    case 'settings':
      return (
        <div className={`relative ${baseClass}`}>
          <Settings className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-gray-500 animate-spin' : ''}`} style={{ animationDuration: isHovered ? '2s' : '0s' }} />
        </div>
      );
    case 'message':
      return (
        <div className={`relative ${baseClass}`}>
          <MessageSquare className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-blue-500 animate-bounce' : ''}`} />
        </div>
      );
    default:
      return <LayoutDashboard className={`${baseClass} ${isHovered ? 'scale-110' : ''}`} />;
  }
};

const menuItems = [
  { title: "Creator Hub", url: "/admin/creator-hub", iconType: "dashboard" },
  { title: "Video Guides", url: "/admin/video-guides", iconType: "play" },
  { title: "Onboarding", url: "/admin/notion", iconType: "file" },
  { title: "Creators", url: "/admin", iconType: "users" },
  { title: "Payouts & Cycles", url: "/admin/payouts", iconType: "dollar" },
  { title: "Rules Settings", url: "/admin/settings", iconType: "settings" },
  { title: "Support Tickets", url: "/admin/support", iconType: "message" },
];

const MenuItemWithAnimation = ({ item, isActive }: { item: typeof menuItems[0]; isActive: boolean }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <SidebarMenuItem 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <SidebarMenuButton asChild isActive={isActive} size="lg">
        <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
          <AnimatedIcon isHovered={isHovered} iconType={item.iconType} />
          <span className="text-base">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

export function AdminSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center gap-2">
            <img src="/creator-catalyst-logo.png" alt="Creator Catalyst" className="w-8 h-8 object-contain" />
            <div className="flex flex-col">
              <span className="font-semibold text-sm" style={{ fontFamily: "'Lilita One', cursive" }}>Creator Catalyst</span>
              <span className="text-xs text-muted-foreground">Admin Panel</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="flex-shrink-0"
            data-testid="button-back"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url || 
                  (item.url !== "/admin" && location.startsWith(item.url));
                return (
                  <MenuItemWithAnimation key={item.title} item={item} isActive={isActive} />
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 flex-shrink-0">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {user ? getInitials(user.email) : "??"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm truncate">{user?.email}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="flex-shrink-0"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
