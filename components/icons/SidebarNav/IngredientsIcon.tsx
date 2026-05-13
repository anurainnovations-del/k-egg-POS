// Ingredient box icon for the sidebar nav
export default function IngredientsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Jar/container body */}
      <path d="M8 3h8l1 3H7L8 3z" />
      <rect x="5" y="6" width="14" height="14" rx="2" />
      {/* Leaf/herb inside */}
      <path d="M12 10c0 0-3 2-3 5h6c0-3-3-5-3-5z" />
      <line x1="12" y1="15" x2="12" y2="18" />
    </svg>
  );
}
