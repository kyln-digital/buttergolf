import { EmptyConversation } from "./_components/EmptyConversation";

export const dynamic = "force-dynamic";

export default function MessagesPage() {
  // On desktop, the layout shows the thread list on the left.
  // This page renders in the right pane as the "no conversation selected" state.
  // On mobile, the layout shows the thread list full-width instead of this page.
  return <EmptyConversation />;
}
