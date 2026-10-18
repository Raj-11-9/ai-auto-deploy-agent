import type { ReactNode } from "react";
import { FolderGit2 } from "lucide-react";
export function EmptyState({
  title,
  children,
  badge,
}: {
  title: string;
  children: ReactNode;
  badge?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <FolderGit2 size={26} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {badge && <span className="tag">{badge}</span>}
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div role="alert" className="error">
      {message}
      <button onClick={retry}>Try again</button>
    </div>
  );
}
export function Loading() {
  return (
    <div role="status" className="loading">
      Connecting to your workspace…
    </div>
  );
}
