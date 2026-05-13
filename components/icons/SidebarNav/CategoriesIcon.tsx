export default function CategoriesIcon({ className }: { className?: string }) {
  return (
    <svg
      width="49"
      height="48"
      viewBox="0 0 49 48"
      fill="currentColor"
      className={className}
    >
      <rect x="8" y="8" width="14" height="14" rx="3" fill="currentColor" />
      <rect x="27" y="8" width="14" height="14" rx="3" fill="currentColor" opacity="0.7" />
      <rect x="8" y="27" width="14" height="14" rx="3" fill="currentColor" opacity="0.7" />
      <rect x="27" y="27" width="14" height="14" rx="3" fill="currentColor" />
    </svg>
  );
}
