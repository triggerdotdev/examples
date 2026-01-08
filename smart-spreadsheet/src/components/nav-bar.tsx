"use client";

import { Table2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = ["Home", "Companies", "Reports"];

export function NavBar() {
  return (
    <nav className="shrink-0 h-16  px-4 border-b border-border flex items-center justify-between bg-background">
      {/* Left: Logo + Title + Nav Tabs */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Table2 className="h-5 w-5 text-primary" />
          <span className="font-semibold text-md tracking-tight">
            Smart Spreadsheet
          </span>
        </div>
        <div className="flex items-center gap-1">
          {navItems.map((label) => (
            <button
              key={label}
              className="px-3 text-sm text-foreground/50 hover:text-foreground hover:cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Theme Toggle + Avatar */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
          DS
        </div>
      </div>
    </nav>
  );
}
