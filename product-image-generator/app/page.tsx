import { Home, ImageIcon, Settings, Upload, User } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import UploadCard from "./components/UploadCard";

export default function ImageManagementApp() {
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
          {/* First Slot - Upload Card */}
          <UploadCard />

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
