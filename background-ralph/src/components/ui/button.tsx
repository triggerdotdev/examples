import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Simpsons-style: 200 base, 300 border, 900 text, hover +100
        default:
          "bg-yellow-200 text-yellow-900 border-2 border-yellow-300 shadow-sm hover:bg-yellow-300 focus-visible:ring-yellow-400",
        destructive:
          "bg-rose-200 text-rose-900 border-2 border-rose-300 shadow-sm hover:bg-rose-300 focus-visible:ring-rose-400",
        outline:
          "border-2 border-yellow-300 bg-transparent text-yellow-900 shadow-sm hover:bg-yellow-200",
        secondary:
          "bg-slate-200 text-slate-900 border-2 border-slate-300 shadow-sm hover:bg-slate-300",
        ghost: "hover:bg-yellow-200 hover:text-yellow-900",
        link: "text-yellow-900 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 min-h-9 px-4 py-2",
        sm: "h-8 min-h-8 rounded-md px-3 text-xs",
        lg: "h-10 min-h-10 rounded-md px-8",
        icon: "h-9 w-9 min-h-9 min-w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
