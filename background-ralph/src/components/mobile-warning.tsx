export function MobileWarning() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 md:hidden">
      <div className="text-center space-y-4">
        <p className="text-[16px] font-semibold text-foreground">Desktop required</p>
        <p className="text-[14px] text-muted-foreground max-w-[280px]">
          Background Ralph needs a larger screen. Please use a desktop browser.
        </p>
      </div>
    </div>
  )
}
