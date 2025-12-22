import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface ComboboxWithAddProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  emptyText?: string;
}

export function ComboboxWithAdd({
  value,
  onChange,
  options,
  placeholder,
  emptyText = "No options found.",
}: ComboboxWithAddProps) {
  const [open, setOpen] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newValue, setNewValue] = useState("");

  const handleAddNew = () => {
    if (newValue.trim()) {
      onChange(newValue.trim());
      setNewValue("");
      setShowAddNew(false);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-popover border border-border z-50" align="start">
        {showAddNew ? (
          <div className="p-3 space-y-2">
            <Input
              placeholder={`Enter new ${placeholder.toLowerCase()}`}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddNew()}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddNew} className="flex-1">
                Add
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddNew(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Command>
            <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option}
                  </CommandItem>
                ))}
                <CommandItem
                  onSelect={() => setShowAddNew(true)}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
