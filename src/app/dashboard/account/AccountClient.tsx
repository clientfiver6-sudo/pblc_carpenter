"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X, Loader2, Eye, EyeOff, KeyRound, AlertTriangle } from "lucide-react";
import { updateUserName, updatePassword } from "@/lib/auth/actions";
import { getInitials } from "@/lib/utils";

interface Props {
  email: string;
  fullName: string;
  businessName: string;
  businessId: string;
  subscriptionStatus: string;
}

export function AccountClient({ email, fullName, businessName, businessId, subscriptionStatus }: Props) {
  const [isPending, startTransition] = useTransition();

  // Name edit
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(fullName);
  const [nameError, setNameError] = useState<string | null>(null);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  // Subscription actions
  const [pauseConfirm, setPauseConfirm] = useState(false);
  const [cancelSubConfirm, setCancelSubConfirm] = useState(false);
  const [subStatus, setSubStatus] = useState(subscriptionStatus);
  const [subActionError, setSubActionError] = useState<string | null>(null);

  // Delete account
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteText, setDeleteText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function saveName() {
    if (!name.trim()) { setNameError("Nome não pode ser vazio."); return; }
    setNameError(null);
    startTransition(async () => {
      const res = await updateUserName(name.trim());
      if (res.error) { setNameError(res.error); return; }
      setEditingName(false);
    });
  }

  function savePassword() {
    setPwError(null);
    if (newPassword.length < 6) { setPwError("A senha deve ter pelo menos 6 caracteres."); return; }
    if (newPassword !== confirmPassword) { setPwError("As senhas não coincidem."); return; }
    startTransition(async () => {
      const res = await updatePassword(newPassword);
      if (res.error) { setPwError(res.error); return; }
      setPwSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => { setShowPasswordForm(false); setPwSuccess(false); }, 2000);
    });
  }

  function handlePause() {
    setSubActionError(null);
    startTransition(async () => {
      const res = await fetch("/api/subscriptions/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      setPauseConfirm(false);
      if (!res.ok) { setSubActionError("Erro ao pausar assinatura. Tente novamente."); return; }
      setSubStatus("paused");
    });
  }

  function handleCancelSub() {
    setSubActionError(null);
    startTransition(async () => {
      const res = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      setCancelSubConfirm(false);
      if (!res.ok) { setSubActionError("Erro ao cancelar assinatura. Tente novamente."); return; }
      setSubStatus("cancelled");
    });
  }

  function handleDeleteAccount() {
    if (deleteText !== "DELETAR MINHA CONTA") { setDeleteError("Texto de confirmação incorreto."); return; }
    setDeleteError(null);
    startTransition(async () => {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, confirmText: deleteText }),
      });
      if (!res.ok) { setDeleteError("Erro ao excluir conta. Tente novamente."); return; }
      window.location.href = "/";
    });
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-border bg-surface-2 text-ink text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
  const canManageSub = subStatus === "active" || subStatus === "trialing" || subStatus === "paused";

  return (
    <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
      {/* Avatar + identity */}
      <div className="flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
          style={{ background: "var(--brand-grad)", color: "white" }}
        >
          {getInitials(name || businessName)}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setEditingName(false); setName(fullName); } }}
                className="flex-1 px-2 py-1 rounded-md border border-brand bg-surface text-ink font-semibold text-base focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              <button onClick={saveName} disabled={isPending} className="p-1.5 rounded-md hover:bg-moss/10 text-moss transition-colors">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={() => { setEditingName(false); setName(fullName); }} className="p-1.5 rounded-md hover:bg-surface-2 text-ink-3 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-ink">{name || "—"}</p>
              <button
                onClick={() => setEditingName(true)}
                className="p-1 rounded-md text-ink-4 hover:text-ink-2 hover:bg-surface-2 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {nameError && <p className="text-xs text-danger mt-1">{nameError}</p>}
          <p className="text-sm text-ink-3 mt-0.5">{email}</p>
        </div>
      </div>

      {/* Password change */}
      <div className="border-t border-border pt-5">
        <button
          type="button"
          onClick={() => { setShowPasswordForm(v => !v); setPwError(null); }}
          className="flex items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink transition-colors"
        >
          <KeyRound className="w-4 h-4 text-ink-3" />
          {showPasswordForm ? "Cancelar alteração de senha" : "Alterar senha"}
        </button>

        {showPasswordForm && (
          <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {pwSuccess ? (
              <div className="flex items-center gap-2 text-sm text-moss bg-moss/8 border border-moss/20 rounded-lg px-4 py-3">
                <Check className="w-4 h-4 shrink-0" />
                Senha atualizada com sucesso!
              </div>
            ) : (
              <>
                {pwError && (
                  <p className="text-sm text-danger bg-danger/8 border border-danger/20 rounded-lg px-4 py-3">{pwError}</p>
                )}
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Nova senha (mín. 6 caracteres)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Confirmar nova senha"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && savePassword()}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={savePassword}
                  disabled={isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-60"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar senha
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Subscription management */}
      {canManageSub && (
        <div className="border-t border-border pt-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">Assinatura</p>
          {subActionError && (
            <p className="text-sm text-danger">{subActionError}</p>
          )}
          {subStatus === "paused" ? (
            <p className="text-sm text-ink-3">Assinatura pausada. Acesse <a href="/dashboard/settings/subscription" className="text-brand hover:underline">Plano & Cobrança</a> para reativar.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {/* Pause */}
              {!pauseConfirm && !cancelSubConfirm && (
                <button
                  onClick={() => setPauseConfirm(true)}
                  className="text-sm text-ink-3 hover:text-warning transition-colors"
                >
                  Pausar assinatura
                </button>
              )}
              {pauseConfirm && (
                <div className="flex items-center gap-3 w-full">
                  <span className="text-sm text-ink-3">Pausar temporariamente?</span>
                  <button
                    onClick={handlePause}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning text-white text-sm font-medium hover:bg-warning/90 disabled:opacity-60 transition-colors"
                  >
                    {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Confirmar pausa
                  </button>
                  <button onClick={() => setPauseConfirm(false)} className="px-3 py-1.5 rounded-lg border border-border text-sm text-ink-3 hover:bg-surface-2 transition-colors">
                    Voltar
                  </button>
                </div>
              )}

              {/* Cancel subscription */}
              {!pauseConfirm && !cancelSubConfirm && (
                <button
                  onClick={() => setCancelSubConfirm(true)}
                  className="text-sm text-ink-3 hover:text-danger transition-colors"
                >
                  Cancelar assinatura
                </button>
              )}
              {cancelSubConfirm && (
                <div className="flex items-center gap-3 w-full">
                  <span className="text-sm text-ink-3">Cancelar definitivamente?</span>
                  <button
                    onClick={handleCancelSub}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger/90 disabled:opacity-60 transition-colors"
                  >
                    {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Confirmar cancelamento
                  </button>
                  <button onClick={() => setCancelSubConfirm(false)} className="px-3 py-1.5 rounded-lg border border-border text-sm text-ink-3 hover:bg-surface-2 transition-colors">
                    Voltar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete account */}
      <div className="border-t border-border pt-5">
        {deleteStep === 0 && (
          <button
            onClick={() => setDeleteStep(1)}
            className="flex items-center gap-2 text-sm text-ink-4 hover:text-danger transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Excluir minha conta
          </button>
        )}

        {deleteStep === 1 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <div className="text-sm text-ink-2 space-y-1">
                <p className="font-semibold text-danger">Esta ação é irreversível.</p>
                <p>Todos os seus dados, clientes, histórico e configurações serão excluídos permanentemente.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteStep(2)}
                className="px-3 py-1.5 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger/90 transition-colors"
              >
                Entendo, continuar
              </button>
              <button
                onClick={() => setDeleteStep(0)}
                className="px-3 py-1.5 rounded-lg border border-border text-sm text-ink-3 hover:bg-surface-2 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {deleteStep === 2 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="text-sm text-ink-2">
              Digite <span className="font-mono font-semibold text-danger">DELETAR MINHA CONTA</span> para confirmar:
            </p>
            <input
              type="text"
              value={deleteText}
              onChange={e => { setDeleteText(e.target.value); setDeleteError(null); }}
              placeholder="DELETAR MINHA CONTA"
              className={`${inputCls} font-mono`}
            />
            {deleteError && <p className="text-sm text-danger">{deleteError}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={isPending || deleteText !== "DELETAR MINHA CONTA"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger/90 disabled:opacity-40 transition-colors"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Excluir conta permanentemente
              </button>
              <button
                onClick={() => { setDeleteStep(0); setDeleteText(""); setDeleteError(null); }}
                className="px-3 py-1.5 rounded-lg border border-border text-sm text-ink-3 hover:bg-surface-2 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
