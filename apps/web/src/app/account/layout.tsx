import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface AccountLayoutProps {
  children: React.ReactNode;
}

/**
 * Account Layout
 * Wraps all /account/* routes with authentication check and consistent styling
 *
 * NOTE: This is a server component for auth - do NOT use Tamagui components here.
 * Tamagui uses React.createContext which fails during Next.js page data collection.
 */
export default async function AccountLayout({ children }: AccountLayoutProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in?redirect=/account");
  }

  return (
    <div
      style={{
        backgroundColor: "var(--background, #FFFAD2)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        paddingBottom: "32px",
      }}
    >
      {children}
    </div>
  );
}
