export default function HubLoading() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <div className="h-24 w-full animate-pulse rounded-2xl bg-[var(--color-sand-100)]" />
      <div className="h-32 w-full animate-pulse rounded-2xl bg-[var(--color-sand-100)]" />
      <div className="h-32 w-full animate-pulse rounded-2xl bg-[var(--color-sand-100)]" />
      <div className="h-32 w-full animate-pulse rounded-2xl bg-[var(--color-sand-100)]" />
    </main>
  );
}
