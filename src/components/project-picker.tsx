import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, FolderKanban, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Project = { id: string; title: string; status: string | null; client?: { name: string | null } | null };

export function ProjectPicker({
  value,
  onChange,
  placeholder = "בחר פרוייקט",
  className,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, status, client:clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  const selected = projects.find(p => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="flex items-center gap-2 truncate">
            <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
            {selected ? (
              <span className="truncate">{selected.title}{selected.client?.name ? ` — ${selected.client.name}` : ""}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          {value ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="opacity-60 hover:opacity-100"
              aria-label="נקה"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" dir="rtl">
        <Command>
          <CommandInput placeholder="חפש פרוייקט…" />
          <CommandList>
            <CommandEmpty>לא נמצאו פרוייקטים</CommandEmpty>
            <CommandGroup>
              {projects.map(p => (
                <CommandItem
                  key={p.id}
                  value={`${p.title} ${p.client?.name ?? ""}`}
                  onSelect={() => { onChange(p.id); setOpen(false); }}
                >
                  <Check className={cn("ml-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-medium truncate">{p.title}</span>
                    {p.client?.name && <span className="text-xs text-muted-foreground truncate">{p.client.name}</span>}
                  </div>
                  {p.status === "closed" && <span className="text-[10px] text-muted-foreground mr-2">סגור</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
