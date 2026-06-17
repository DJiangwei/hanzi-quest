import { notFound } from 'next/navigation';
import { assertAdmin } from '@/lib/auth/guards';

export const metadata = {
  title: 'Admin Console — hanzi-quest',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await assertAdmin();
  } catch {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      {children}
    </main>
  );
}
