import { redirect } from "next/navigation";
import { getAdminForPage } from "@/lib/admin-auth";
import { AdminShell } from "./_components/AdminShell";

export const dynamic = "force-dynamic";

/**
 * Admin portal layout.
 *
 * proxy.ts already requires a signed-in session for /admin/*; this decides
 * whether that session is staff. Anyone else is sent home rather than shown
 * a 403, so the portal's existence isn't advertised.
 *
 * NOTE: server component for the role check - no Tamagui imports here.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminForPage();
  if (!admin) {
    redirect("/");
  }

  return (
    <div style={{ width: "100%", minHeight: "calc(100vh - 80px)" }}>
      <AdminShell
        viewer={{
          name: `${admin.firstName} ${admin.lastName}`.trim() || admin.email,
          role: admin.role,
        }}
      >
        {children}
      </AdminShell>
    </div>
  );
}
