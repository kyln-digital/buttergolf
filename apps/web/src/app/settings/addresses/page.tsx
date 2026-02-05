import { redirect } from "next/navigation";

/**
 * Settings Addresses Page - Redirects to Account Addresses
 *
 * The /settings/addresses route now redirects to /account/addresses.
 * This maintains backwards compatibility with any existing links.
 */
export default function SettingsAddressesPage() {
  redirect("/account/addresses");
}
