export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex flex-1 items-center justify-center px-4 py-12"
      style={{
        background:
          'linear-gradient(to bottom, var(--color-ocean-100) 0%, var(--color-sand-50) 70%)',
      }}
    >
      {children}
    </main>
  );
}
