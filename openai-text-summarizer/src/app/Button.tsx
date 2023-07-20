export type ButtonProps = {
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent) => void;
  disabled?: boolean;
} & React.HTMLAttributes<HTMLButtonElement>;

export function Button({ children, onClick, disabled }: ButtonProps) {
  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={disabled}
      className="w-full font-sans rounded transition disabled:opacity-50 disabled:pointer-events-none bg-indigo-600 hover:bg-indigo-500 h-10 font-semibold"
    >
      {children}
    </button>
  );
}
