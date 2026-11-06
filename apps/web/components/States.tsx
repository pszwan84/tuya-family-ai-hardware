'use client';

export function LoadingState({ count = 3 }: { count?: number }) {
  return (
    <div className="grid" aria-busy="true" aria-label="加载中">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton" />
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="state">
      <strong>{title}</strong>
      <span>{hint ?? '这里还没有内容。家人有新的日常时会出现在这里。'}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state">
      <strong>暂时没能加载</strong>
      <span>{message}</span>
      {onRetry ? (
        <p>
          <button className="btn" onClick={onRetry}>
            重试
          </button>
        </p>
      ) : null}
    </div>
  );
}