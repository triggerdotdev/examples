import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Simpsons-style: 800 base with 200 highlight/border
        default:
          "bg-yellow-700 text-white border-2 border-yellow-300 shadow-sm hover:bg-yellow-600 focus-visible:ring-yellow-400",
        destructive:
          "bg-red-800 text-white border-2 border-red-300 shadow-sm hover:bg-red-700 focus-visible:ring-red-400",
        outline:
          "border-2 border-yellow-600 bg-transparent text-yellow-800 shadow-sm hover:bg-yellow-100 hover:border-yellow-700",
        secondary:
          "bg-slate-700 text-white border-2 border-slate-300 shadow-sm hover:bg-slate-600",
        ghost: "hover:bg-yellow-100 hover:text-yellow-800",
        link: "text-yellow-700 underline-offset-4 hover:underline hover:text-yellow-800",
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
