"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function FilterDropdown({ label, options, selected, onChange }: Props) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1 text-sm h-9">
            {label}
            {selected.length > 0 && (
              <span className="ml-1 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                {selected.length}
              </span>
            )}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </Button>
        }
      />

      <DropdownMenuContent className="w-56 max-h-72 overflow-y-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>{label}</span>
            {selected.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-blue-500 hover:underline font-normal"
              >
                Xóa
              </button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.length === 0 ? (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              Chưa có dữ liệu
            </div>
          ) : (
            options.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt}
                checked={selected.includes(opt)}
                onCheckedChange={() => toggle(opt)}
                closeOnClick={false}
              >
                {opt}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
