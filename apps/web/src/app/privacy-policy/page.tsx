import type { Metadata } from "next";
import { PrivacyPolicyClient } from "./_components/PrivacyPolicyClient";

export const metadata: Metadata = {
  title: "Privacy Policy | ButterGolf",
  description: "How ButterGolf collects, uses, and protects your personal information",
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyClient />;
}
