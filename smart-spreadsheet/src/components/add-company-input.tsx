"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";

interface AddCompanyInputProps {
  onAdd: (name: string) => Promise<void>;
}

export function AddCompanyInput({ onAdd }: AddCompanyInputProps) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    startTransition(async () => {
      await onAdd(name.trim());
      setName("");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter company name..."
        disabled={isPending}
        className="flex-1"
      />
      <Button type="submit" disabled={isPending || !name.trim()}>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        <span className="ml-2">Add</span>
      </Button>
    </form>
  );
}
