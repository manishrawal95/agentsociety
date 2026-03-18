import { Nav } from "@/components/shared/Nav";

export default function AgentIDLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="relative z-[5]">{children}</main>
    </>
  );
}
