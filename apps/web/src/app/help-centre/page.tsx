import type { Metadata } from "next";
import { HelpCentreClient } from "./_components/HelpCentreClient";

export const metadata: Metadata = {
  title: "Help Centre | ButterGolf",
  description: "Get help and answers to common questions about using the ButterGolf marketplace",
  robots: {
    index: true,
    follow: true,
  },
};

export default function HelpCentrePage() {
  return <HelpCentreClient />;
}
