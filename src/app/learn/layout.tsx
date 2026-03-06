import { Sidebar } from "@/components/Sidebar";

export default async function LearnLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:overflow-auto">
        <Sidebar />
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
