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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Clapperboard, Video, ShieldCheck, UserCircle, LogOut, X, WalletCards, BookOpen, Play, UsersRound, Lock, Mail, Building2, Gift, Copy, Check, Crown, LucideIcon, DollarSign, Gem } from "lucide-react";

const AnimatedIcon = ({ isHovered, iconType }: { icon?: LucideIcon; isHovered: boolean; iconType?: string }) => {
  const baseClass = "w-5 h-5 transition-all duration-300";
  
  switch (iconType) {
    case 'dollar':
      return (
        <div className={`relative ${baseClass}`}>
          <DollarSign className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-blue-500 animate-wallet-open' : ''}`} />
        </div>
      );
    case 'video':
      return (
        <div className={`relative ${baseClass}`}>
          <Clapperboard className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-red-500 animate-clap' : ''}`} />
        </div>
      );
    case 'play':
      return (
        <div className={`relative ${baseClass}`}>
          <Play className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-sky-500 animate-play-pulse fill-sky-500' : ''}`} />
        </div>
      );
    case 'trophy':
      return (
        <div className={`relative ${baseClass}`}>
          <Crown className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-yellow-500 animate-crown-bounce' : ''}`} />
        </div>
      );
    case 'shield':
      return (
        <div className={`relative ${baseClass}`}>
          <ShieldCheck className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-blue-500 animate-shield-pulse' : ''}`} />
        </div>
      );
    case 'user':
      return (
        <div className={`relative ${baseClass}`}>
          <UserCircle className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-sky-500 animate-user-wave' : ''}`} />
        </div>
      );
    case 'users':
      return (
        <div className={`relative ${baseClass}`}>
          <UsersRound className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-cyan-500 animate-users-gather' : ''}`} />
        </div>
      );
    case 'file':
      return (
        <div className={`relative ${baseClass}`}>
          <BookOpen className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-orange-500 animate-book-flip' : ''}`} />
        </div>
      );
    case 'gem':
      return (
        <div className={`relative ${baseClass}`}>
          <Gem className={`w-5 h-5 transition-all duration-300 ${isHovered ? 'text-sky-500 animate-crown-bounce' : ''}`} />
        </div>
      );
    default:
      return <Play className={`${baseClass} ${isHovered ? 'scale-110' : ''}`} />;
  }
};

const menuItems = [
  { title: "Video Guides", url: "/creator/video-guides", iconType: "play" },
  { title: "Onboarding", url: "/creator/notion", iconType: "file" },
  { title: "Creator Overview", url: "/creator/dashboard", iconType: "video" },
  { title: "Creator Hub", url: "/creator/creator-hub", iconType: "trophy" },
  { title: "Payouts Info", url: "/creator/payouts", iconType: "dollar" },
  { title: "Guidelines & Support", url: "/creator/rules", iconType: "shield" },
  { title: "My Socials", url: "/creator/connect", iconType: "user" },
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

export function CreatorSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [affiliateDialogOpen, setAffiliateDialogOpen] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [affiliateHovered, setAffiliateHovered] = useState(false);

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("contact@neonmoneytalks.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContactClick = () => {
    setShowEmail(true);
  };

  const handleDialogClose = (open: boolean) => {
    setAffiliateDialogOpen(open);
    if (!open) {
      setShowEmail(false);
      setCopied(false);
    }
  };

  return (
    <>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center px-2 py-2">
            <div className="flex items-center gap-2">
              <img src="/creator-catalyst-logo.png" alt="Creator Catalyst" className="w-8 h-8 object-contain" />
              <div className="flex flex-col">
                <span className="font-semibold text-sm" style={{ fontFamily: "'Lilita One', cursive" }}>Creator Catalyst</span>
                <span className="text-xs text-muted-foreground">Creator Dashboard</span>
              </div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="relative ml-0 pl-0">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gray-200 dark:bg-gray-700 rounded-full" />
                {menuItems.map((item) => {
                  const isActive = location === item.url || 
                    (item.url !== "/creator" && location.startsWith(item.url));
                  return (
                    <MenuItemWithAnimation key={item.title} item={item} isActive={isActive} />
                  );
                })}
                <SidebarMenuItem
                  onMouseEnter={() => setAffiliateHovered(true)}
                  onMouseLeave={() => setAffiliateHovered(false)}
                >
                  <SidebarMenuButton 
                    size="lg"
                    onClick={() => setAffiliateDialogOpen(true)}
                    data-testid="link-affiliate"
                  >
                    <AnimatedIcon isHovered={affiliateHovered} iconType="users" />
                    <span className="text-base">Affiliate</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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

      <Dialog open={affiliateDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-col items-center text-center pt-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-sky-500 flex items-center justify-center mb-2">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-lg font-semibold">Become an affiliate</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Invite your other brand managers to come use our UGC management platform
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex gap-2 p-3 rounded-lg bg-muted/50">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-sky-500" />
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm">For Agencies & Teams</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Manage multiple creators and calculate payouts automatically. When your brand manager upgrades, they can connect payout rates, bonuses, and campaign terms—so you can see exactly what you're owed.
                </p>
              </div>
            </div>

            <div className="flex gap-2 p-3 rounded-lg bg-muted/50">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
                  <Gift className="w-4 h-4 text-sky-500" />
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm">Invite Your Manager & Earn</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Ask your brand manager or agency to unlock this feature. If you're the one who gets them to upgrade, you'll earn a percentage of their monthly subscription for as long as they're subscribed.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-1 pb-1">
            {!showEmail ? (
              <Button 
                className="w-full bg-gradient-to-r from-sky-500 to-sky-500 hover:from-sky-600 hover:to-sky-600 text-white"
                onClick={handleContactClick}
              >
                Contact Us
              </Button>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
                <Mail className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium flex-1">contact@neonmoneytalks.com</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={handleCopyEmail}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
