import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Settings, 
  DollarSign,
  Video,
  Eye,
  Save,
  Loader2,
  TrendingUp,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Trophy
} from "lucide-react";
import { SiInstagram, SiTiktok } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BonusTier } from "@shared/schema";

interface SettingsFormData {
  instagramBasePayPerVideo: number;
  tiktokBasePayPerVideo: number;
  minVideosPerWeek: number;
  maxVideosPerDay: number;
}

interface PayoutSettingsData {
  id: number;
  basePay: string | null;
  updatedAt: string;
  instagramBasePayPerVideo: number;
  tiktokBasePayPerVideo: number;
  minVideosPerWeek: number;
  maxVideosPerDay: number;
}

interface SettingsResponse {
  current: PayoutSettingsData;
  pending: Partial<PayoutSettingsData> | null;
}

export default function AdminSettings() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [editViewThreshold, setEditViewThreshold] = useState("");
  const [editBonusAmount, setEditBonusAmount] = useState("");
  const [newViewThreshold, setNewViewThreshold] = useState("");
  const [newBonusAmount, setNewBonusAmount] = useState("");
  const [showAddTier, setShowAddTier] = useState(false);

  const { data: settingsData, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["/api/admin/settings/payout"],
    enabled: !!token,
  });

  const { data: bonusTiers = [], isLoading: tiersLoading } = useQuery<BonusTier[]>({
    queryKey: ["/api/admin/bonus-tiers"],
    enabled: !!token,
  });

  const sortedTiers = [...bonusTiers].sort((a, b) => a.viewThreshold - b.viewThreshold);

  const settings = settingsData?.current;

  const { register, handleSubmit, formState: { errors, isDirty }, reset, watch } = useForm<SettingsFormData>({
    values: settings ? {
      instagramBasePayPerVideo: settings.instagramBasePayPerVideo,
      tiktokBasePayPerVideo: settings.tiktokBasePayPerVideo,
      minVideosPerWeek: settings.minVideosPerWeek,
      maxVideosPerDay: settings.maxVideosPerDay,
    } : undefined,
  });

  const watchedMinVideos = watch("minVideosPerWeek");
  const watchedMaxVideos = watch("maxVideosPerDay");

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      const response = await apiRequest("PUT", "/api/admin/settings/payout", data);
      return response as SettingsResponse & { message: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/payout"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] });
      reset(data.current);
      toast({
        title: "Settings saved",
        description: "Changes have been applied immediately to the current cycle.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to save settings",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const createTierMutation = useMutation({
    mutationFn: async (data: { viewThreshold: number; bonusAmount: number }) => {
      return await apiRequest("POST", "/api/admin/bonus-tiers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bonus-tiers"] });
      setNewViewThreshold("");
      setNewBonusAmount("");
      setShowAddTier(false);
      toast({ title: "Bonus tier created" });
    },
    onError: (error) => {
      toast({
        title: "Failed to create tier",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateTierMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { viewThreshold?: number; bonusAmount?: number } }) => {
      return await apiRequest("PUT", `/api/admin/bonus-tiers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bonus-tiers"] });
      setEditingTierId(null);
      toast({ title: "Bonus tier updated" });
    },
    onError: (error) => {
      toast({
        title: "Failed to update tier",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteTierMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/bonus-tiers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bonus-tiers"] });
      toast({ title: "Bonus tier deleted" });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete tier",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartEdit = (tier: BonusTier) => {
    setEditingTierId(tier.id);
    setEditViewThreshold(tier.viewThreshold.toString());
    setEditBonusAmount(tier.bonusAmount.toString());
  };

  const handleSaveEdit = () => {
    if (!editingTierId) return;
    updateTierMutation.mutate({
      id: editingTierId,
      data: {
        viewThreshold: Number(editViewThreshold),
        bonusAmount: Number(editBonusAmount),
      },
    });
  };

  const handleAddTier = () => {
    createTierMutation.mutate({
      viewThreshold: Number(newViewThreshold),
      bonusAmount: Number(newBonusAmount),
    });
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(views % 1000000 === 0 ? 0 : 1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(views % 1000 === 0 ? 0 : 1)}K`;
    return views.toString();
  };

  const onSubmit = (data: SettingsFormData) => {
    updateSettingsMutation.mutate({
      instagramBasePayPerVideo: Number(data.instagramBasePayPerVideo),
      tiktokBasePayPerVideo: Number(data.tiktokBasePayPerVideo),
      minVideosPerWeek: Number(data.minVideosPerWeek),
      maxVideosPerDay: Number(data.maxVideosPerDay),
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Settings className="h-8 w-8" />
          Rules Settings
        </h1>
        <p className="text-muted-foreground">
          Configure payout rates, bonuses, and posting rules for all creators.
        </p>
      </div>

      <Card className="mb-6 border-blue-500/50 bg-blue-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-500">Settings apply immediately</p>
              <p className="text-sm text-muted-foreground mt-1">
                Any changes you make will take effect right away and apply to the current pay cycle.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Payment Rates</CardTitle>
                <CardDescription>
                  Set the base pay per video and bonus amounts for high-performing content
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="instagramBasePayPerVideo" className="flex items-center gap-2">
                  <SiInstagram className="w-4 h-4 text-pink-500" />
                  Instagram Base Pay ($)
                </Label>
                <Input
                  id="instagramBasePayPerVideo"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register("instagramBasePayPerVideo", { 
                    required: "Instagram base pay is required",
                    min: { value: 0, message: "Must be 0 or greater" }
                  })}
                  data-testid="input-instagram-base-pay"
                />
                {errors.instagramBasePayPerVideo && (
                  <p className="text-sm text-destructive">{errors.instagramBasePayPerVideo.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Per video rate for Instagram
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tiktokBasePayPerVideo" className="flex items-center gap-2">
                  <SiTiktok className="w-4 h-4" />
                  TikTok Base Pay ($)
                </Label>
                <Input
                  id="tiktokBasePayPerVideo"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register("tiktokBasePayPerVideo", { 
                    required: "TikTok base pay is required",
                    min: { value: 0, message: "Must be 0 or greater" }
                  })}
                  data-testid="input-tiktok-base-pay"
                />
                {errors.tiktokBasePayPerVideo && (
                  <p className="text-sm text-destructive">{errors.tiktokBasePayPerVideo.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Per video rate for TikTok
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm font-medium mb-2">Base Pay Example:</p>
              <p className="text-sm text-muted-foreground">
                A creator posts 3 Instagram videos and 2 TikTok videos:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>Instagram: 3 videos x ${settings?.instagramBasePayPerVideo || 20} = ${(3 * (settings?.instagramBasePayPerVideo || 20)).toFixed(2)}</li>
                <li>TikTok: 2 videos x ${settings?.tiktokBasePayPerVideo || 20} = ${(2 * (settings?.tiktokBasePayPerVideo || 20)).toFixed(2)}</li>
                <li className="font-medium text-foreground">Base Total: ${((3 * (settings?.instagramBasePayPerVideo || 20)) + (2 * (settings?.tiktokBasePayPerVideo || 20))).toFixed(2)}</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Plus bonuses based on view milestones (see Bonus Tiers below)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Bonus Tiers</CardTitle>
                  <CardDescription>
                    Configure view milestones and bonus amounts. Each video earns ONE bonus for its highest tier reached.
                  </CardDescription>
                </div>
              </div>
              {!showAddTier && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowAddTier(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Tier
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {tiersLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : sortedTiers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No bonus tiers configured</p>
                <p className="text-sm">Add tiers to reward creators for high-performing videos</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedTiers.map((tier) => (
                  <div 
                    key={tier.id} 
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {editingTierId === tier.id ? (
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-muted-foreground" />
                          <Input
                            type="number"
                            value={editViewThreshold}
                            onChange={(e) => setEditViewThreshold(e.target.value)}
                            className="w-32"
                            placeholder="Views"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                          <Input
                            type="number"
                            value={editBonusAmount}
                            onChange={(e) => setEditBonusAmount(e.target.value)}
                            className="w-24"
                            placeholder="Amount"
                          />
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleSaveEdit}
                            disabled={updateTierMutation.isPending}
                          >
                            {updateTierMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4 text-green-500" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingTierId(null)}
                          >
                            <X className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{formatViews(tier.viewThreshold)} views</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-blue-500" />
                            <span className="font-medium text-blue-600">${tier.bonusAmount}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartEdit(tier)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTierMutation.mutate(tier.id)}
                            disabled={deleteTierMutation.isPending}
                          >
                            {deleteTierMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-red-500" />
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {showAddTier && (
              <div className="flex items-center gap-4 p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    value={newViewThreshold}
                    onChange={(e) => setNewViewThreshold(e.target.value)}
                    className="w-32"
                    placeholder="Views"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    value={newBonusAmount}
                    onChange={(e) => setNewBonusAmount(e.target.value)}
                    className="w-24"
                    placeholder="Amount"
                  />
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleAddTier}
                    disabled={createTierMutation.isPending || !newViewThreshold || !newBonusAmount}
                  >
                    {createTierMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Check className="w-4 h-4 mr-1" />
                    )}
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddTier(false);
                      setNewViewThreshold("");
                      setNewBonusAmount("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm font-medium mb-2">How Bonus Tiers Work:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Each video earns ONE bonus based on its highest tier reached</li>
                <li>A video with 45K views reaching the 30K tier earns that tier's bonus only</li>
                <li>Bonuses are NOT cumulative - only the highest tier counts</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Posting Rules</CardTitle>
                <CardDescription>
                  Define minimum and maximum video requirements for creators
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="minVideosPerWeek" className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-500" />
                  Minimum Videos per Week
                </Label>
                <Input
                  id="minVideosPerWeek"
                  type="number"
                  min="0"
                  max="50"
                  step="1"
                  {...register("minVideosPerWeek", {
                    required: "Minimum videos per week is required",
                    min: { value: 0, message: "Must be 0 or greater" },
                    max: { value: 50, message: "Must be 50 or less" }
                  })}
                />
                {errors.minVideosPerWeek && (
                  <p className="text-sm text-destructive">{errors.minVideosPerWeek.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Creators must post at least this many videos each week
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxVideosPerDay" className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-500" />
                  Maximum Videos per Day
                </Label>
                <Input
                  id="maxVideosPerDay"
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  {...register("maxVideosPerDay", {
                    required: "Maximum videos per day is required",
                    min: { value: 1, message: "Must be at least 1" },
                    max: { value: 50, message: "Must be 50 or less" }
                  })}
                />
                {errors.maxVideosPerDay && (
                  <p className="text-sm text-destructive">{errors.maxVideosPerDay.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Maximum number of videos creators can post per day
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm font-medium mb-2">Rule Enforcement:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Creators posting fewer than {watchedMinVideos ?? settings?.minVideosPerWeek ?? 3} videos per week will be flagged</li>
                <li>Creators posting more than {watchedMaxVideos ?? settings?.maxVideosPerDay ?? 10} videos per day will receive a violation</li>
                <li>Violations are logged and can affect future payouts</li>
              </ul>
            </div>
          </CardContent>
        </Card>


        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={updateSettingsMutation.isPending || !isDirty}
            size="lg"
            data-testid="button-save-settings"
          >
            {updateSettingsMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
