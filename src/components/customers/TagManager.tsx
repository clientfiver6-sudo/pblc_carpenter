"use client";

import { useState, useTransition } from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from "@/components/ui/command";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { updateCustomerTags } from "@/lib/customers/actions";
import { X, Plus, Tag } from "lucide-react";

const COMMON_TAGS = [
  "VIP",
  "Regular",
  "Novo",
  "Fidelizado",
  "Inativo",
  "Alergico",
  "Preferencial",
];

interface TagManagerProps {
  customerId: string;
  currentTags: string[];
  onUpdate?: (tags: string[]) => void;
}

export function TagManager({
  customerId,
  currentTags,
  onUpdate,
}: TagManagerProps) {
  const [tags, setTags] = useState<string[]>(currentTags);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const suggestions = COMMON_TAGS.filter(
    (t) =>
      !tags.includes(t) &&
      t.toLowerCase().includes(inputValue.toLowerCase())
  );

  async function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    const next = [...tags, trimmed];
    setTags(next);
    setInputValue("");
    setOpen(false);
    onUpdate?.(next);
    startTransition(async () => {
      try {
        await updateCustomerTags(customerId, next);
      } catch {
        // revert on error
        setTags(tags);
        onUpdate?.(tags);
      }
    });
  }

  async function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    onUpdate?.(next);
    startTransition(async () => {
      try {
        await updateCustomerTags(customerId, next);
      } catch {
        setTags(tags);
        onUpdate?.(tags);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 bg-surface-2 text-ink-2 border border-border rounded-full text-xs px-2.5 py-0.5"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            disabled={isPending}
            className="ml-0.5 rounded-full text-ink-4 hover:text-danger transition-colors"
            aria-label={`Remover etiqueta ${tag}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 border border-dashed border-border rounded-full text-xs px-2 py-0.5",
              "text-brand hover:text-brand-2 hover:border-border-2 transition-colors"
            )}
          >
            <Plus className="w-3 h-3" />
            Etiqueta
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-52 bg-surface border-border"
          align="start"
        >
          <Command className="bg-transparent">
            <CommandInput
              placeholder="Adicionar etiqueta..."
              value={inputValue}
              onValueChange={setInputValue}
              className="text-ink placeholder:text-ink-4 border-b border-border h-9"
            />
            <CommandList>
              <CommandEmpty>
                {inputValue.trim() ? (
                  <button
                    type="button"
                    onClick={() => addTag(inputValue)}
                    className="w-full px-3 py-2 text-left text-sm text-ink-2 hover:text-ink flex items-center gap-2"
                  >
                    <Tag className="w-3 h-3" />
                    Criar {'"'}{inputValue.trim()}{'"'}
                  </button>
                ) : (
                  <span className="text-ink-3 px-3 py-2 text-sm block">
                    Nenhuma sugestão
                  </span>
                )}
              </CommandEmpty>
              {suggestions.length > 0 && (
                <CommandGroup heading="">
                  {suggestions.map((t) => (
                    <CommandItem
                      key={t}
                      value={t}
                      onSelect={() => addTag(t)}
                      className="cursor-pointer text-ink-2 hover:text-ink data-[selected=true]:bg-surface-2"
                    >
                      <Tag className="w-3 h-3 mr-2 shrink-0" />
                      {t}
                    </CommandItem>
                  ))}
                  {inputValue.trim() && !COMMON_TAGS.includes(inputValue.trim()) && (
                    <CommandItem
                      value={`create-${inputValue}`}
                      onSelect={() => addTag(inputValue)}
                      className="cursor-pointer text-ink-2 hover:text-ink data-[selected=true]:bg-surface-2"
                    >
                      <Plus className="w-3 h-3 mr-2 shrink-0" />
                      Criar {'"'}{inputValue.trim()}{'"'}
                    </CommandItem>
                  )}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
