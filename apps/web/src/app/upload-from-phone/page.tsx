import type { Metadata } from "next";
import { PhoneUploadClient } from "./_components/PhoneUploadClient";

/**
 * Upload From Phone — the page a seller lands on after scanning the QR code
 * shown by the sell form on their computer.
 *
 * Deliberately outside `/sell` so Clerk's route protection doesn't demand a
 * sign-in on the phone: the QR code's token (carried in the URL fragment, so it
 * never reaches this server component) is the credential. Header, footer and
 * the mobile app interstitial are suppressed for this route in the root layout.
 */
export const metadata: Metadata = {
  title: "Send photos - ButterGolf",
  robots: { index: false, follow: false },
};

// The root layout's viewport applies here unchanged: this is an ordinary
// browser page, so pinch-to-zoom stays available for low-vision sellers.

export default function UploadFromPhonePage() {
  return <PhoneUploadClient />;
}
