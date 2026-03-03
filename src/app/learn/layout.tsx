import { Sidebar } from "@/components/Sidebar";

export default async function LearnLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
      <aside className="md:sticky md:top-4 md:h-[calc(100vh-6rem)] md:overflow-auto">
        <Sidebar />
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}

