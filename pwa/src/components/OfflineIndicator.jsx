export default function OfflineIndicator({ isOnline, pendingCount }) {
  if (isOnline && !pendingCount) return null;

  return (
    <div className={`offline-bar ${isOnline ? "offline-bar--sync" : ""}`} role="status">
      {isOnline ? (
        <span>🔄 Syncing {pendingCount} offline change{pendingCount === 1 ? "" : "s"}…</span>
      ) : (
        <span>⚠️ You are offline — changes are saved locally{pendingCount ? ` (${pendingCount} pending)` : ""}.</span>
      )}
    </div>
  );
}
