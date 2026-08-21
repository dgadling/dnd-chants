"use client";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html><body><div className="p-8">Error: {error.message}</div><button onClick={() => reset()}>retry</button></body></html>
  );
}
