import type { PrismTheme } from "prism-react-renderer";

/**
 * The Trigger.dev code theme, ported from the marketing site's CodeBlock:
 * indigo plain text on charcoal-900, apple-green strings, orchid keywords,
 * lime functions. Keeps CodeCard snippets looking like the real docs.
 */
export const triggerCodeTheme: PrismTheme = {
  plain: {
    color: "#9C9AF2",
    backgroundColor: "#121317",
  },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#5F6570" } },
    { types: ["punctuation"], style: { color: "#878C99" } },
    {
      types: ["property", "tag", "boolean", "number", "constant", "symbol", "deleted"],
      style: { color: "#9B99FF" },
    },
    { types: ["selector", "attr-name", "string", "char", "builtin", "inserted"], style: { color: "#AFEC73" } },
    { types: ["operator", "entity", "url"], style: { color: "#D4D4D4" } },
    { types: ["variable"], style: { color: "#CCCBFF" } },
    { types: ["atrule", "attr-value", "keyword"], style: { color: "#E888F8" } },
    { types: ["function", "class-name"], style: { color: "#D9F07C" } },
    { types: ["regex"], style: { color: "#d16969" } },
    { types: ["important", "bold"], style: { fontWeight: "bold" } },
    { types: ["italic"], style: { fontStyle: "italic" } },
    { types: ["namespace"], style: { opacity: 0.7 } },
    { types: ["deleted"], style: { color: "#F85149" } },
    { types: ["boolean"], style: { color: "#9B99FF" } },
    { types: ["char"], style: { color: "#b5cea8" } },
    { types: ["tag"], style: { color: "#D7BA7D" } },
    { types: ["keyword.operator"], style: { color: "#8271ED" } },
    { types: ["meta.template.expression"], style: { color: "#d4d4d4" } },
  ],
};
