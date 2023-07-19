export type ButtonProps = {
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent) => void;
};

export function Button({ children, onClick }: ButtonProps) {
  return (
    <button
      type="submit"
      onClick={onClick}
      className="w-full font-sans rounded transition bg-indigo-600 hover:bg-indigo-500 h-10 font-semibold"
    >
      {children}
    </button>
  );
}
