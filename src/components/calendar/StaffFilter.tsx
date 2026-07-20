"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Staff } from "@/types/database";

interface StaffFilterProps {
  staffList: Staff[];
  selectedStaffId: string | null;
  onChange: (staffId: string | null) => void;
}

export function StaffFilter({ staffList, selectedStaffId, onChange }: StaffFilterProps) {
  const value = selectedStaffId ?? "all";

  function handleChange(val: string) {
    onChange(val === "all" ? null : val);
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="w-44 h-8 text-xs bg-surface border-border text-ink focus:ring-brand/20">
        <SelectValue>
          {selectedStaffId ? (
            <span className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    staffList.find((s) => s.id === selectedStaffId)?.color ??
                    "var(--ink-4)",
                }}
              />
              {staffList.find((s) => s.id === selectedStaffId)?.name ?? "Staff"}
            </span>
          ) : (
            <span className="text-ink-3">Todos os colaboradores</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-surface border-border">
        <SelectItem
          value="all"
          className="text-xs text-ink-3 focus:bg-surface-2 focus:text-ink"
        >
          Todos os colaboradores
        </SelectItem>
        {staffList.map((staff) => (
          <SelectItem
            key={staff.id}
            value={staff.id}
            className="text-xs text-ink focus:bg-surface-2"
          >
            <span className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: staff.color ?? "var(--ink-4)" }}
              />
              {staff.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
