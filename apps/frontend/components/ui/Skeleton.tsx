

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-busy="true"
      className={`animate-pulse rounded-md bg-muted ${className ?? ""}`}
    />
  );
}