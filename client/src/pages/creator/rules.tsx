import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertTriangle, XCircle, Calendar, Clock, Shield, Eye, Wallet, Ban, Award, DollarSign, MessageSquare, Send, Loader2 } from "lucide-react";
import { formatUTCDate } from "@/lib/date-utils";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Violation, SupportTicket } from "@shared/schema";

interface BonusTier {
  id: string;
  viewThreshold: number;
  bonusAmount: number;
}

const formatViewCount = (views: number): string => {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(views % 1000000 === 0 ? 0 : 1)}M`;
  } else if (views >= 1000) {
    return `${(views / 1000).toFixed(views % 1000 === 0 ? 0 : 1)}K`;
  }
  return views.toString();
};

interface ComplianceData {
  videosToday: number;
  videosThisWeek: number;
  maxPerDay: number;
  minPerWeek: number;
  violations: Violation[];
}

export default function CreatorRules() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"guidelines" | "support">("guidelines");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data: compliance, isLoading } = useQuery<ComplianceData>({
    queryKey: ["/api/creator/compliance"],
    enabled: !!token,
  });

  const { data: bonusTiers } = useQuery<BonusTier[]>({
    queryKey: ["/api/bonus-tiers"],
    enabled: !!token,
  });

  const { data: tickets, isLoading: ticketsLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/creator/support-tickets"],
    enabled: !!token && activeTab === "support",
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string }) => {
      return apiRequest("POST", "/api/creator/support-tickets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creator/support-tickets"] });
      setSubject("");
      setMessage("");
      toast({
        title: "Message sent",
        description: "We'll get back to you as soon as possible.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const sortedTiers = bonusTiers?.slice().sort((a, b) => a.viewThreshold - b.viewThreshold) || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in both subject and message.",
        variant: "destructive",
      });
      return;
    }
    createTicketMutation.mutate({ subject, message });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Open</Badge>;
      case "in_progress":
        return <Badge variant="default" className="gap-1"><Loader2 className="w-3 h-3" />In Progress</Badge>;
      case "resolved":
        return <Badge variant="secondary" className="gap-1 bg-chart-2/20 text-chart-2"><CheckCircle className="w-3 h-3" />Resolved</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const videosToday = compliance?.videosToday || 0;
  const videosThisWeek = compliance?.videosThisWeek || 0;
  const maxPerDay = compliance?.maxPerDay || 2;
  const minPerWeek = compliance?.minPerWeek || 3;

  const dailyStatus = videosToday <= maxPerDay ? "compliant" : "violation";
  const weeklyProgress = Math.min((videosThisWeek / minPerWeek) * 100, 100);
  const weeklyStatus = videosThisWeek >= minPerWeek ? "compliant" : videosThisWeek >= 2 ? "at-risk" : "violation";

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Guidelines & Support</h1>
            <p className="text-muted-foreground">
              {activeTab === "guidelines" 
                ? "Stay on track with posting requirements to maximize your earnings."
                : "Get in touch with our team for any questions or support."}
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={activeTab === "guidelines" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("guidelines")}
              className="gap-2 text-xs h-7"
            >
              <Shield className="w-3.5 h-3.5" />
              Guidelines
            </Button>
            <Button
              variant={activeTab === "support" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("support")}
              className="gap-2 text-xs h-7"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Support
            </Button>
          </div>
        </div>
      </div>

      {activeTab === "support" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send a Message
              </CardTitle>
              <CardDescription>
                Describe your issue or question and we'll respond as soon as possible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Brief description of your issue"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    data-testid="input-ticket-subject"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Please provide details about your question or issue..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    data-testid="input-ticket-message"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={createTicketMutation.isPending}
                  data-testid="button-submit-ticket"
                >
                  {createTicketMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Your Messages
              </CardTitle>
              <CardDescription>
                View your previous messages and responses.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ticketsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              ) : !tickets || tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
                  <p className="text-muted-foreground max-w-sm">
                    When you send a message, it will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-4 rounded-lg border"
                      data-testid={`ticket-${ticket.id}`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <h4 className="font-medium">{ticket.subject}</h4>
                          <p className="text-sm text-muted-foreground">
                            {ticket.createdAt ? formatUTCDate(ticket.createdAt, "MMM d, yyyy 'at' h:mm a") : "Unknown date"}
                          </p>
                        </div>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <p className="text-sm mb-3">{ticket.message}</p>
                      {ticket.adminResponse && (
                        <div className="mt-3 p-3 rounded-lg bg-muted">
                          <p className="text-sm font-medium mb-1">Response:</p>
                          <p className="text-sm">{ticket.adminResponse}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "guidelines" && sortedTiers.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Award className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Bonus Tiers</CardTitle>
                <CardDescription>
                  Earn bonus payments when your videos hit these view milestones. Each video earns the bonus for its highest tier reached.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedTiers.map((tier) => (
                <div
                  key={tier.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Eye className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-medium">{formatViewCount(tier.viewThreshold)} views</span>
                  </div>
                  <Badge className="bg-gradient-to-r from-sky-500 to-green-400 text-white shadow-lg shadow-sky-500/30 gap-1">
                    <DollarSign className="w-3 h-3" />
                    ${tier.bonusAmount}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "guidelines" && (
        <>
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Creator Guidelines</CardTitle>
                  <CardDescription>
                    Please read and follow these rules carefully to maintain your account in good standing
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 p-4 rounded-lg border bg-muted/50">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">Public Engagement Visibility</h4>
                <p className="text-sm text-muted-foreground">
                  Your post engagement metrics (likes, comments, views) must remain visible to the public at all times. Hidden engagement statistics will prevent accurate tracking and may affect your payout eligibility.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-lg border bg-muted/50">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">Bonus Calculation</h4>
                <p className="text-sm text-muted-foreground">
                  Bonuses are calculated based on the video performance within that particular payout cycle. Views and engagement earned during the cycle determine your bonus amount for that period.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-lg border bg-destructive/5 border-destructive/20">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <Ban className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h4 className="font-semibold mb-1 text-destructive">Zero Tolerance for Artificial Engagement</h4>
                <p className="text-sm text-muted-foreground">
                  The use of bots, fake views, purchased likes, or any form of artificial engagement is strictly prohibited. Every video is manually reviewed by our team. Accounts found violating this policy will be <strong>permanently banned</strong> without warning, and all pending earnings will be forfeited.
                </p>
              </div>
            </div>
          </div>
          </CardContent>
        </Card>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Daily Limit</CardTitle>
                </div>
                {dailyStatus === "compliant" ? (
                  <Badge variant="secondary" className="gap-1 bg-chart-2/20 text-chart-2">
                    <CheckCircle className="w-3 h-3" />
                    Compliant
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" />
                    Exceeded
                  </Badge>
                )}
              </div>
              <CardDescription>Maximum {maxPerDay} videos per day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <span className="text-4xl font-bold font-mono" data-testid="text-videos-today">
                  {videosToday}
                </span>
                <span className="text-muted-foreground text-lg">/ {maxPerDay}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {videosToday === 0 
                  ? "No videos posted today yet."
                  : videosToday === 1
                  ? "You can post 1 more video today."
                  : videosToday === 2
                  ? "Daily limit reached. Great job!"
                  : "You've exceeded the daily limit."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Weekly Minimum</CardTitle>
                </div>
                {weeklyStatus === "compliant" ? (
                  <Badge variant="secondary" className="gap-1 bg-chart-2/20 text-chart-2">
                    <CheckCircle className="w-3 h-3" />
                    Compliant
                  </Badge>
                ) : weeklyStatus === "at-risk" ? (
                  <Badge variant="secondary" className="gap-1 bg-chart-4/20 text-chart-4">
                    <AlertTriangle className="w-3 h-3" />
                    At Risk
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Behind
                  </Badge>
                )}
              </div>
              <CardDescription>Minimum {minPerWeek} videos per week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <span className="text-4xl font-bold font-mono" data-testid="text-videos-week">
                  {videosThisWeek}
                </span>
                <span className="text-muted-foreground text-lg">/ {minPerWeek}</span>
              </div>
              <Progress value={weeklyProgress} className="h-2 mb-3" />
              <p className="text-sm text-muted-foreground">
                {videosThisWeek >= minPerWeek
                  ? "Weekly requirement met!"
                  : `${minPerWeek - videosThisWeek} more video${minPerWeek - videosThisWeek > 1 ? "s" : ""} needed this week.`}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Violation History</CardTitle>
            <CardDescription>
              Past rule violations that may affect your account standing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!compliance?.violations || compliance.violations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-chart-2/10 flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-chart-2" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No violations</h3>
                <p className="text-muted-foreground max-w-sm">
                  Great job! You have no rule violations on your account.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {compliance.violations.map((violation) => (
                  <div
                    key={violation.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                    data-testid={`violation-${violation.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {violation.type === "max_2_per_day"
                            ? "Exceeded daily posting limit"
                            : "Did not meet weekly minimum"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatUTCDate(violation.date, "MMMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive">Violation</Badge>
                  </div>
                ))}
              </div>
            )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
