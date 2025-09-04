"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, User, Settings, Home, ImageIcon } from "lucide-react";
import { useState, useRef } from "react";
import { triggerHelloWorld } from "./actions";
import type { helloWorldTask } from "@/src/trigger/example";

export default function ImageManagementApp() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger task via Server Action
  const triggerTask = async (payload: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await triggerHelloWorld(payload);

      if (result.success) {
        setRunId(result.runId || null);
      } else {
        setError(result.error || "Failed to trigger task");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger task");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find((file) => file.type.startsWith("image/"));

    if (imageFile) {
      await triggerTask(`Hello from ${imageFile.name}!`);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      await triggerTask(`Hello from ${file.name}!`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold text-primary font-[family-name:var(--font-playfair)]">
              ImageFlow
            </h1>
            <nav className="hidden md:flex items-center gap-6">
              <Button variant="ghost" size="sm" className="gap-2">
                <Home className="h-4 w-4" />
                Home
              </Button>
              <Button variant="ghost" size="sm" className="gap-2">
                <ImageIcon className="h-4 w-4" />
                My Images
              </Button>
              <Button variant="ghost" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </nav>
          </div>
          <Button variant="ghost" size="sm" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2 font-[family-name:var(--font-playfair)]">
            Image Gallery
          </h2>
          <p className="text-muted-foreground">
            Upload and organize your images with our intuitive drag-and-drop
            interface
          </p>
        </div>

        {/* Image Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* First Slot - Drag and Drop Area */}
          <Card
            className={`aspect-square border-2 border-dashed transition-colors cursor-pointer group ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-primary/30 bg-card hover:border-primary/50"
            } ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${
                  isDragOver
                    ? "bg-primary/20"
                    : "bg-primary/10 group-hover:bg-primary/20"
                }`}
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                ) : (
                  <Upload className="h-6 w-6 text-primary" />
                )}
              </div>
              <p className="text-sm font-medium text-card-foreground mb-1">
                {isLoading ? "Processing..." : "Drag and drop an image here"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Please wait" : "or click to browse"}
              </p>
              {runId && (
                <p className="text-xs text-green-600 mt-2">
                  Task triggered! Run ID: {runId}
                </p>
              )}
              {error && (
                <p className="text-xs text-red-600 mt-2">Error: {error}</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </Card>

          {/* Remaining 7 Slots - Blank States */}
          {Array.from({ length: 7 }).map((_, index) => (
            <Card
              key={index + 1}
              className="aspect-square bg-card border border-border"
            >
              <div className="h-full flex items-center justify-center">
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4">
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Images
          </Button>
          <Button variant="outline" className="gap-2 bg-transparent">
            <Settings className="h-4 w-4" />
            Organize
          </Button>
        </div>
      </main>
    </div>
  );
}
