import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Column } from "@buttergolf/ui";

export const dynamic = "force-dynamic";

interface AccountLayoutProps {
  children: React.ReactNode;
}

/**
 * Account Layout
 * Wraps all /account/* routes with authentication check and consistent styling
 */
export default async function AccountLayout({ children }: AccountLayoutProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in?redirect=/account");
  }

  return (
    <Column
      backgroundColor="$background"
      minHeight="100vh"
      alignItems="center"
      width="100%"
      paddingBottom="$xl"
    >
      {children}
    </Column>
  );
}
