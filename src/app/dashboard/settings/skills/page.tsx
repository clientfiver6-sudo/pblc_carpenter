"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Plus, Trash2, Edit2, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createSkill, updateSkill, deleteSkill, toggleSkillActive } from "@/lib/skills/actions";
import { createClient } from "@/lib/supabase/client";
import type { BusinessSkill } from "@/types/database";

interface SkillFormState {
  name: string;
  content: string;
}

const SUGGESTIONS = [
  {
    label: "Tom de voz",
    name: "Tom de voz",
    content:
      "Use linguagem amigável e descontraída, sem formalidade excessiva. Escreva como se estivesse conversando com um amigo, mas sempre com respeito. Use emojis com moderação.",
  },
  {
    label: "Resposta sobre preços",
    name: "Resposta sobre preços",
    content:
      "Ao falar sobre preços, seja direto e mencione as formas de pagamento aceitas. Se o cliente hesitar, ofereça parcelamento ou uma avaliação gratuita.",
  },
  {
    label: "Fora do horário",
    name: "Fora do horário",
    content:
      "Quando fora do horário de atendimento, informe o horário e ofereça agendamento pelo próprio WhatsApp. Não deixe o cliente sem resposta.",
  },
  {
    label: "O que nunca falar",
    name: "O que nunca falar",
    content:
      "Nunca mencione concorrentes. Não prometa prazos ou preços não confirmados. Nunca seja rude, mesmo se o cliente estiver insatisfeito.",
  },
  {
    label: "Perfil do cliente",
    name: "Perfil do cliente ideal",
    content:
      "Nossos clientes são principalmente... [descreva o perfil]. Adapte a linguagem e recomendações para esse perfil.",
  },
  {
    label: "Promoções ativas",
    name: "Promoções ativas",
    content:
      "Temos as seguintes promoções ativas: [liste aqui]. Quando relevante, mencione proativamente.",
  },
];

export default function SkillsSettingsPage() {
  const [skills, setSkills] = useState<BusinessSkill[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<SkillFormState>({ name: "", content: "" });
  const [isAdding, startAddTransition] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SkillFormState>({ name: "", content: "" });
  const [isEditing, startEditTransition] = useTransition();
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => { loadSkills(); }, []);

  async function loadSkills() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: rawBu } = await supabase.from("business_users").select("business_id").eq("user_id", user.id).single();
    const bu = rawBu as { business_id: string } | null;
    if (!bu?.business_id) { setLoading(false); return; }
    const { data: rawSkills } = await supabase.from("business_skills").select("*").eq("business_id", bu.business_id).order("order_index", { ascending: true });
    setSkills((rawSkills as BusinessSkill[] | null) ?? []);
    setLoading(false);
  }

  const existingNames = new Set(skills.map(s => s.name.toLowerCase()));

  function openAddWithTemplate(name: string, content: string) {
    setAddForm({ name, content });
    setAddError(null);
    setAddOpen(true);
  }

  function handleAddSubmit() {
    if (!addForm.name.trim() || !addForm.content.trim()) {
      setAddError("Preencha o nome e o conteúdo da instrução");
      return;
    }
    setAddError(null);
    startAddTransition(async () => {
      const result = await createSkill({ name: addForm.name.trim(), content: addForm.content.trim() });
      if (result.error) { setAddError(result.error); return; }
      setAddOpen(false);
      setAddForm({ name: "", content: "" });
      await loadSkills();
    });
  }

  function startEdit(skill: BusinessSkill) {
    setEditId(skill.id);
    setEditForm({ name: skill.name, content: skill.content });
    setEditError(null);
  }

  function handleEditSubmit(id: string) {
    if (!editForm.name.trim() || !editForm.content.trim()) {
      setEditError("Preencha o nome e o conteúdo");
      return;
    }
    setEditError(null);
    startEditTransition(async () => {
      const result = await updateSkill(id, { name: editForm.name.trim(), content: editForm.content.trim() });
      if (result.error) { setEditError(result.error); return; }
      setEditId(null);
      await loadSkills();
    });
  }

  function handleDelete(id: string) {
    setDeleteId(id);
    startDeleteTransition(async () => {
      await deleteSkill(id);
      setDeleteId(null);
      await loadSkills();
    });
  }

  async function handleToggle(skill: BusinessSkill) {
    setTogglingId(skill.id);
    await toggleSkillActive(skill.id, !skill.active);
    setTogglingId(null);
    await loadSkills();
  }

  return (
    <div className="max-w-[720px] mx-auto px-6 py-8 pb-28 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-tint">
            <Sparkles className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">Instruções de IA</h2>
            <p className="text-sm text-ink-3">Como a IA deve se comportar ao atender seus clientes</p>
          </div>
        </div>

        <Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) setAddForm({ name: "", content: "" }); }}>
          <DialogTrigger asChild>
            <Button
              onClick={() => { setAddForm({ name: "", content: "" }); setAddError(null); }}
              className="text-white font-semibold gap-1.5"
              style={{ background: "var(--brand-grad)" }}
            >
              <Plus className="h-4 w-4" />
              Nova instrução
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-surface border-border text-ink">
            <DialogHeader>
              <DialogTitle className="text-ink">Nova instrução</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-ink-2">Título</Label>
                <Input
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Tom de voz"
                  className="border-border bg-surface text-ink placeholder:text-ink-4 focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-ink-2">Instrução</Label>
                <Textarea
                  value={addForm.content}
                  onChange={e => setAddForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Descreva como a IA deve se comportar neste aspecto…"
                  rows={5}
                  className="border-border bg-surface text-ink placeholder:text-ink-4 focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
                />
              </div>
              {addError && (
                <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded px-3 py-2">{addError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)} className="border-border text-ink-2">Cancelar</Button>
              <Button onClick={handleAddSubmit} disabled={isAdding} className="text-white font-semibold" style={{ background: "var(--brand-grad)" }}>
                {isAdding ? "Salvando…" : "Adicionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Explanation callout */}
      <div className="rounded-xl border border-brand/20 bg-tint/50 px-5 py-4 flex gap-3 items-start">
        <span className="text-brand text-base mt-0.5 shrink-0 font-bold">✦</span>
        <div>
          <p className="text-sm font-semibold text-ink">A IA lê essas instruções antes de cada atendimento</p>
          <p className="text-sm text-ink-3 mt-0.5 leading-relaxed">
            Use para definir o tom das mensagens, o que fazer em situações específicas, e o que nunca dizer.
            Quanto mais específico, mais consistente fica o atendimento.
          </p>
        </div>
      </div>

      {/* Suggestion chips */}
      <div>
        <p className="text-xs text-ink-4 font-medium uppercase tracking-wider mb-2.5">Sugestões para começar</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => {
            const used = existingNames.has(s.name.toLowerCase());
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => !used && openAddWithTemplate(s.name, s.content)}
                disabled={used}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  used
                    ? "border-border text-ink-4 bg-surface-2 cursor-default opacity-50"
                    : "border-brand/30 text-brand bg-tint/60 hover:bg-tint hover:border-brand/50"
                }`}
              >
                {used && <span className="text-brand">✓</span>}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Instruction cards */}
      {loading ? (
        <div className="py-12 text-center text-ink-3 text-sm">Carregando instruções…</div>
      ) : skills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center space-y-3">
          <Sparkles className="h-8 w-8 text-border mx-auto" />
          <p className="text-ink-3 text-sm max-w-xs mx-auto leading-relaxed">
            Clique em uma sugestão acima ou em &quot;Nova instrução&quot; para começar a configurar a IA
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {skills.map(skill => (
            <div
              key={skill.id}
              className={`bg-surface border border-border rounded-xl p-5 space-y-3 transition-opacity ${!skill.active ? "opacity-50" : ""}`}
            >
              {editId === skill.id ? (
                /* Inline edit form */
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-ink-2 text-xs">Título</Label>
                    <Input
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="border-border bg-surface text-ink focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-ink-2 text-xs">Instrução</Label>
                    <Textarea
                      value={editForm.content}
                      onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                      rows={4}
                      className="border-border bg-surface text-ink focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
                    />
                  </div>
                  {editError && <p className="text-xs text-danger">{editError}</p>}
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setEditId(null)} className="border-border text-ink-2">Cancelar</Button>
                    <Button size="sm" onClick={() => handleEditSubmit(skill.id)} disabled={isEditing} className="text-white font-semibold" style={{ background: "var(--brand-grad)" }}>
                      {isEditing ? "Salvando…" : "Salvar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Top row: tag + actions */}
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-tint text-brand">
                      ✦ {skill.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Active toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggle(skill)}
                        disabled={togglingId === skill.id}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors disabled:opacity-50"
                        title={skill.active ? "Desativar" : "Ativar"}
                      >
                        {skill.active
                          ? <Eye className="h-3.5 w-3.5" />
                          : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => startEdit(skill)}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {/* Delete */}
                      <Dialog open={deleteId === skill.id} onOpenChange={open => { if (!open) setDeleteId(null); }}>
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setDeleteId(skill.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-ink-3 hover:bg-danger/10 hover:text-danger transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="bg-surface border-border text-ink">
                          <DialogHeader>
                            <DialogTitle className="text-ink">Excluir instrução?</DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-ink-3 py-2">Esta ação não pode ser desfeita.</p>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteId(null)} className="border-border text-ink-2">Cancelar</Button>
                            <Button onClick={() => handleDelete(skill.id)} disabled={isDeleting} className="bg-danger text-white font-semibold">
                              {isDeleting ? "Excluindo…" : "Excluir"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  {/* Content */}
                  <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-wrap">{skill.content}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
