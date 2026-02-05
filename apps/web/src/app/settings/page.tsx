import { redirect } from "next/navigation";

/**
 * Settings Page - Redirects to Account Hub
 *
 * The /settings route now redirects to /account where all settings are centralized.
 * This maintains backwards compatibility with any existing links.
 */
export default function SettingsPage() {
  redirect("/account");
}
