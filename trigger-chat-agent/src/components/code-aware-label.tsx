import { cn } from "@/lib/utils";

/** Labels that look like API identifiers keep their casing and code semantics. */
function isCodeIdentifier(value: string): boolean {
  return (
    /[a-z\d][A-Z]/.test(value) ||
    /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(value) ||
    /^[A-Za-z_$][\w$]*\(\)$/.test(value)
  );
}

export function CodeAwareLabel({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  if (isCodeIdentifier(value)) {
    return (
      <code
        className={cn(
          "rounded-md bg-charcoal-900 px-1.5 py-0.5 font-mono normal-case tracking-normal",
          className,
        )}
      >
        {value}
      </code>
    );
  }

  return <span className={className}>{value}</span>;
}
