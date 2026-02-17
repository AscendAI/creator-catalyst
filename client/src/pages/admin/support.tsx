import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Clock, CheckCircle, Loader2, Send, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatUTCDate } from "@/lib/date-utils";
import type { SupportTicket } from "@shared/schema";

type TicketWithEmail = SupportTicket & { creatorEmail: string };

export default function AdminSupport() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [selectedTicket, setSelectedTicket] = useState<TicketWithEmail | null>(null);
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState("");

  const { data: tickets, isLoading } = useQuery<TicketWithEmail[]>({
    queryKey: ["/api/admin/support-tickets"],
    enabled: !!token,
  });

  const updateTicketMutation = useMutation({
    mutationFn: async (data: { id: string; status?: string; adminResponse?: string }) => {
      return apiRequest("PATCH", `/api/admin/support-tickets/${data.id}`, {
        status: data.status,
        adminResponse: data.adminResponse,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-tickets"] });
      setSelectedTicket(null);
      setResponse("");
      setStatus("");
      toast({
        title: "Ticket updated",
        description: "The support ticket has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update ticket",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUpdateTicket = () => {
    if (!selectedTicket) return;
    
    updateTicketMutation.mutate({
      id: selectedTicket.id,
      status: status || undefined,
      adminResponse: response || undefined,
    });
  };

  const getStatusBadge = (ticketStatus: string) => {
    switch (ticketStatus) {
      case "open":
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Open</Badge>;
      case "in_progress":
        return <Badge variant="default" className="gap-1"><Loader2 className="w-3 h-3" />In Progress</Badge>;
      case "resolved":
        return <Badge variant="secondary" className="gap-1 bg-chart-2/20 text-chart-2"><CheckCircle className="w-3 h-3" />Resolved</Badge>;
      default:
        return <Badge variant="secondary">{ticketStatus}</Badge>;
    }
  };

  const openTickets = tickets?.filter(t => t.status === "open") || [];
  const inProgressTickets = tickets?.filter(t => t.status === "in_progress") || [];
  const resolvedTickets = tickets?.filter(t => t.status === "resolved") || [];

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Support Tickets</h1>
        <p className="text-muted-foreground">
          View and respond to creator support requests.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open Tickets
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono" data-testid="text-open-tickets">
              {openTickets.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono" data-testid="text-progress-tickets">
              {inProgressTickets.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Resolved
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono" data-testid="text-resolved-tickets">
              {resolvedTickets.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            All Tickets
          </CardTitle>
          <CardDescription>
            Click on a ticket to respond or update its status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!tickets || tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No support tickets</h3>
              <p className="text-muted-foreground max-w-sm">
                When creators submit support requests, they will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 rounded-lg border hover-elevate cursor-pointer"
                  onClick={() => {
                    setSelectedTicket(ticket);
                    setResponse(ticket.adminResponse || "");
                    setStatus(ticket.status);
                  }}
                  data-testid={`admin-ticket-${ticket.id}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{ticket.subject}</h4>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{ticket.creatorEmail}</span>
                        <span>-</span>
                        <span>
                          {ticket.createdAt 
                            ? formatUTCDate(ticket.createdAt, "MMM d, yyyy 'at' h:mm a") 
                            : "Unknown date"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{ticket.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.subject}</DialogTitle>
            <DialogDescription>
              From: {selectedTicket?.creatorEmail} - {selectedTicket?.createdAt 
                ? formatUTCDate(selectedTicket.createdAt, "MMM d, yyyy 'at' h:mm a") 
                : "Unknown date"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm font-medium mb-2">Creator's Message:</p>
              <p className="text-sm">{selectedTicket?.message}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-ticket-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Your Response</label>
              <Textarea
                placeholder="Type your response to the creator..."
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={4}
                data-testid="input-admin-response"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedTicket(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateTicket}
                disabled={updateTicketMutation.isPending}
                data-testid="button-update-ticket"
              >
                {updateTicketMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Update Ticket
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
