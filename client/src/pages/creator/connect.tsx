import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Instagram, Save, Loader2, Info } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function CreatorConnect() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUsername, setTiktokUsername] = useState("");

  useEffect(() => {
    if (user) {
      setInstagramUrl(user.instagramUsername || "");
      setTiktokUsername(user.tiktokUsername || "");
    }
  }, [user]);

  const updateSocialsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PUT", "/api/creator/socials", {
        instagramUsername: instagramUrl,
        tiktokUsername: tiktokUsername,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      refreshUser?.();
      toast({
        title: "Social accounts updated",
        description: "Your social media accounts have been saved. Videos will be synced automatically.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const hasInstagram = !!instagramUrl;
  const hasTiktok = !!tiktokUsername;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Social Accounts</h1>
        <p className="text-muted-foreground">
          Add your social media accounts so we can track your videos and calculate your earnings.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 via-pink-500 to-orange-400 flex items-center justify-center">
                  <Instagram className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Instagram</CardTitle>
                  <CardDescription>Add your Instagram username</CardDescription>
                </div>
              </div>
              {hasInstagram && (
                <Badge variant="secondary" className="gap-1 bg-chart-2/20 text-chart-2">
                  <CheckCircle className="w-3 h-3" />
                  Added
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instagram-username">Instagram Username</Label>
                <Input
                  id="instagram-username"
                  placeholder="yourusername (without @)"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  data-testid="input-instagram-username"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your Instagram username without the @ symbol
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center">
                  <SiTiktok className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">TikTok</CardTitle>
                  <CardDescription>Add your TikTok username</CardDescription>
                </div>
              </div>
              {hasTiktok && (
                <Badge variant="secondary" className="gap-1 bg-chart-2/20 text-chart-2">
                  <CheckCircle className="w-3 h-3" />
                  Added
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tiktok-username">TikTok Username</Label>
                <Input
                  id="tiktok-username"
                  placeholder="yourusername (without @)"
                  value={tiktokUsername}
                  onChange={(e) => setTiktokUsername(e.target.value)}
                  data-testid="input-tiktok-username"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your TikTok username without the @ symbol
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={() => updateSocialsMutation.mutate()}
          disabled={updateSocialsMutation.isPending}
          className="w-full"
          size="lg"
          data-testid="button-save-socials"
        >
          {updateSocialsMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save My Social Accounts
        </Button>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Info className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">How it works</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>Add your Instagram and TikTok accounts above</li>
                  <li>Your public videos will be synced automatically</li>
                  <li>We track views, likes, and comments for your earnings</li>
                  <li>You get paid for TikTok + Instagram pairs</li>
                  <li>Make sure your accounts are set to public</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
