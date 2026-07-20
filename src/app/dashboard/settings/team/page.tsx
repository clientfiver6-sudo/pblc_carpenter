"use client";

import { useState, useTransition, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Users, Plus, Trash2 } from "lucide-react";
import { inviteTeamMember, updateTeamMemberRole, removeTeamMember } from "@/lib/settings/actions";
import { createClient } from "@/lib/supabase/client";
import type { BusinessUser, UserRole } from "@/types/database";
import { getInitials } from "@/lib/utils";

interface TeamMember extends BusinessUser {
  email: string;
  full_name: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Proprietário",
  manager: "Gerente",
  staff: "Funcionário",
};

export default function TeamSettingsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"manager" | "staff">("staff");
  const [isInviting, startInviteTransition] = useTransition();
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Remove dialog
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();

  // Role change
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  useEffect(() => {
    loadTeam();
  }, []);

  async function loadTeam() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    setCurrentUserId(user.id);

    const { data: rawBu } = await supabase
      .from("business_users")
      .select("business_id")
      .eq("user_id", user.id)
      .single();
    const bu = rawBu as { business_id: string } | null;

    if (!bu?.business_id) { setLoading(false); return; }

    const { data: rawBusUsers } = await supabase
      .from("business_users")
      .select("*")
      .eq("business_id", bu.business_id)
      .order("created_at", { ascending: true });
    const busUsers = rawBusUsers as import("@/types/database").BusinessUser[] | null;

    if (!busUsers) { setLoading(false); return; }

    // Enrich with display info — only current user has full auth data on client
    const enriched: TeamMember[] = busUsers.map((bu2) => ({
      ...bu2,
      email:
        bu2.user_id === user.id
          ? (user.email ?? "")
          : `••••••••@...`,
      full_name:
        bu2.user_id === user.id
          ? ((user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Usuário")
          : "Membro da equipe",
    }));

    setMembers(enriched);
    setLoading(false);
  }

  function handleInvite() {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      setInviteError("Informe um e-mail válido");
      return;
    }
    setInviteError(null);
    startInviteTransition(async () => {
      try {
        await inviteTeamMember(inviteEmail.trim(), inviteRole);
        setInviteSuccess(true);
        setTimeout(() => {
          setInviteOpen(false);
          setInviteEmail("");
          setInviteRole("staff");
          setInviteSuccess(false);
          loadTeam();
        }, 1500);
      } catch (err) {
        setInviteError(err instanceof Error ? err.message : "Erro ao convidar");
      }
    });
  }

  async function handleRoleChange(member: TeamMember, newRole: "manager" | "staff") {
    setUpdatingRoleId(member.id);
    try {
      await updateTeamMemberRole(member.id, newRole);
      await loadTeam();
    } finally {
      setUpdatingRoleId(null);
    }
  }

  function handleRemove(member: TeamMember) {
    setRemoveTarget(member);
    startRemoveTransition(async () => {
      try {
        await removeTeamMember(member.id);
        setRemoveTarget(null);
        await loadTeam();
      } catch {
        setRemoveTarget(null);
      }
    });
  }

  function roleBadge(role: UserRole) {
    if (role === "owner") return <Badge variant="warm">{ROLE_LABELS[role]}</Badge>;
    if (role === "manager") return <Badge variant="info">{ROLE_LABELS[role]}</Badge>;
    return <Badge variant="secondary">{ROLE_LABELS[role]}</Badge>;
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="max-w-[860px] mx-auto px-4 sm:px-6 md:px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-6">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-tint flex items-center justify-center">
              <Users className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-ink tracking-tight">Equipe</h2>
              <p className="text-sm text-ink-3 mt-0.5">
                Gerencie os membros com acesso ao RetornAI
              </p>
            </div>
          </div>

          <Dialog
            open={inviteOpen}
            onOpenChange={(open) => {
              setInviteOpen(open);
              if (!open) {
                setInviteEmail("");
                setInviteRole("staff");
                setInviteError(null);
                setInviteSuccess(false);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="text-white rounded-md h-10 px-5 font-semibold text-sm gap-1.5"
                style={{ background: 'var(--brand-grad)' }}
              >
                <Plus className="h-4 w-4" />
                Convidar membro
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-surface border-border text-ink">
              <DialogHeader>
                <DialogTitle className="text-ink">Convidar membro da equipe</DialogTitle>
              </DialogHeader>
              {inviteSuccess ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-brand font-medium">Convite enviado!</p>
                  <p className="text-sm text-ink-3">
                    O membro receberá um e-mail com o link de acesso.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">E-mail</Label>
                    <Input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      type="email"
                      placeholder="email@exemplo.com"
                      className="border border-border bg-surface text-ink rounded-md h-10 px-3 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-ink-4"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">Função</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(v) => setInviteRole(v as "manager" | "staff")}
                    >
                      <SelectTrigger className="border border-border bg-surface text-ink rounded-md h-10 px-3 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-surface border-border">
                        <SelectItem
                          value="manager"
                          className="text-ink focus:bg-surface-2 focus:text-brand"
                        >
                          Gerente — acesso completo exceto configurações financeiras
                        </SelectItem>
                        <SelectItem
                          value="staff"
                          className="text-ink focus:bg-surface-2 focus:text-brand"
                        >
                          Funcionário — acesso operacional básico
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {inviteError && (
                    <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded px-3 py-2">
                      {inviteError}
                    </p>
                  )}
                </div>
              )}
              {!inviteSuccess && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setInviteOpen(false)}
                    className="border-border text-ink hover:bg-surface-2"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleInvite}
                    disabled={isInviting}
                    className="text-white font-semibold rounded-md h-10 px-5 text-sm"
                    style={{ background: 'var(--brand-grad)' }}
                  >
                    {isInviting ? "Enviando..." : "Enviar convite"}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-surface border border-border rounded-lg shadow-1">
          <CardContent className="p-0">
            {loading ? (
              <div className="px-6 py-12 text-center text-ink-3 text-sm">
                Carregando equipe...
              </div>
            ) : members.length === 0 ? (
              <div className="px-6 py-16 text-center text-ink-3 text-sm">
                Nenhum membro encontrado.
              </div>
            ) : (
              members.map((member, idx) => {
                const isOwner = member.role === "owner";
                const isCurrentUser = member.user_id === currentUserId;
                return (
                  <div key={member.id}>
                    <div className="flex items-center gap-3 py-3.5 border-b border-border last:border-0 px-4">
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full bg-tint text-brand-2 font-semibold text-xs flex items-center justify-center shrink-0">
                        {getInitials(member.full_name)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-ink">
                            {member.full_name}
                            {isCurrentUser && (
                              <span className="ml-1.5 text-xs text-ink-3">(você)</span>
                            )}
                          </span>
                          {roleBadge(member.role)}
                        </div>
                        <p className="text-xs text-ink-3 mt-0.5 truncate">{member.email}</p>
                      </div>

                      {/* Controls */}
                      {!isOwner && !isCurrentUser && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Select
                            value={member.role}
                            onValueChange={(v) =>
                              handleRoleChange(member, v as "manager" | "staff")
                            }
                            disabled={updatingRoleId === member.id}
                          >
                            <SelectTrigger className="h-8 w-32 border border-border bg-surface text-ink text-xs rounded-md px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-surface border-border">
                              <SelectItem
                                value="manager"
                                className="text-ink focus:bg-surface-2 focus:text-brand text-xs"
                              >
                                Gerente
                              </SelectItem>
                              <SelectItem
                                value="staff"
                                className="text-ink focus:bg-surface-2 focus:text-brand text-xs"
                              >
                                Funcionário
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          <Dialog
                            open={removeTarget?.id === member.id}
                            onOpenChange={(open) => {
                              if (!open) setRemoveTarget(null);
                            }}
                          >
                            <DialogTrigger asChild>
                              <button
                                type="button"
                                onClick={() => setRemoveTarget(member)}
                                className="h-8 w-8 flex items-center justify-center rounded-md text-ink-4 hover:text-danger transition-colors"
                                aria-label="Remover membro"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </DialogTrigger>
                            <DialogContent className="bg-surface border-border text-ink">
                              <DialogHeader>
                                <DialogTitle className="text-ink">
                                  Remover membro?
                                </DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-ink-3 py-2">
                                {member.full_name} perderá o acesso ao RetornAI imediatamente.
                              </p>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setRemoveTarget(null)}
                                  className="border-border text-ink hover:bg-surface-2"
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  onClick={() => handleRemove(member)}
                                  disabled={isRemoving}
                                  className="bg-danger text-white hover:bg-danger/90 font-semibold"
                                >
                                  {isRemoving ? "Removendo..." : "Remover"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                    </div>
                    {idx < members.length - 1 && <Separator className="bg-border" />}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
