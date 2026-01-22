import { Suspense } from "react";

/**
 * Layout for mobile onboarding page
 *
 * This is a minimal layout that:
 * - Removes header/footer chrome (WebView should be full-screen)
 * - Wraps in Suspense for useSearchParams
 * - Uses the app's default providers from root layout
 */
export default function MobileOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FFFAD2",
          }}
        >
          <p style={{ color: "#323232" }}>Loading...</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export const metadata = {
  title: "Seller Setup - ButterGolf",
  robots: "noindex, nofollow", // Don't index this page
};
