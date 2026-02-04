import type { Metadata } from "next";
import { TermsOfServiceClient } from "./_components/TermsOfServiceClient";

export const metadata: Metadata = {
  title: "Terms of Service | ButterGolf",
  description: "Terms and conditions for using the ButterGolf marketplace platform",
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsOfServicePage() {
  return <TermsOfServiceClient />;
}
