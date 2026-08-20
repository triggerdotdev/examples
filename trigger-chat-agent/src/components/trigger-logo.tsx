import { useId } from "react";
import { cn } from "@/lib/utils";

// Official Trigger.dev mark from https://trigger.dev/brand, sized as an icon.
export function TriggerLogo({ className }: { className?: string }) {
  // Several responsive lockups can exist in the DOM at once. A unique paint
  // server id prevents a visible logo from resolving the gradient inside a
  // different, currently hidden SVG.
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M41.6889 52.2795 60.4195 20l46.4195 80H14l18.7305-32.2805 13.2496 7.6117-5.4798 9.4444h39.8384L60.4195 50.4478l-5.4799 9.4444-13.2507-7.6127Z"
        fill={`url(#${gradientId})`}
      />
      <defs>
        <linearGradient
          id={gradientId}
          x1="89.1675"
          y1="100"
          x2="88.3094"
          y2="43.5225"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#41FF54" />
          <stop offset="1" stopColor="#E7FF52" />
        </linearGradient>
      </defs>
    </svg>
  );
}
