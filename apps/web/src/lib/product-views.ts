import { prisma } from "@buttergolf/db";

interface ProductViewContext {
  /** Drafts aren't public, so opening one is never a buyer view. */
  isDraft: boolean;
  /** The product's owner. */
  ownerUserId: string;
  /** The signed-in viewer's user id, or null when anonymous. */
  viewerUserId: string | null;
}

/**
 * Whether opening a product should count towards its buyer-view metric.
 *
 * A seller's own visits don't count. That matters more than it looks: both the
 * public product page and the edit form (which hydrates through the product
 * GET) run this path, so without the owner check a seller reloading their own
 * listing inflates the number they use to judge how it's performing.
 */
export function shouldCountProductView({
  isDraft,
  ownerUserId,
  viewerUserId,
}: ProductViewContext): boolean {
  if (isDraft) return false;
  return viewerUserId !== ownerUserId;
}

/**
 * Records a buyer view when the context warrants one. Fire-and-forget: a failed
 * increment is logged, never surfaced, and never blocks the render.
 */
export function recordProductView(productId: string, context: ProductViewContext): void {
  if (!shouldCountProductView(context)) return;

  prisma.product
    .update({
      where: { id: productId },
      data: { views: { increment: 1 } },
    })
    .catch((err) => console.error("Failed to increment views:", err));
}
