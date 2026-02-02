"use client";

import { useState, useEffect } from "react";
import { Column, Row } from "@buttergolf/ui";
import { ConversationThread } from "./ConversationThread";
import { CounterOfferForm } from "./CounterOfferForm";
import { ProductSummaryCard } from "./ProductSummaryCard";
import { MobileProductBar } from "./MobileProductBar";
import { OffersSidebar } from "../../_components/OffersSidebar";
import { useOfferUpdates } from "@/hooks/useOfferUpdates";
import type { Prisma } from "@buttergolf/db";

/**
 * Client Component: Offer Detail Interactive UI
 *
 * Displays three-column layout with:
 * - Left: Offers sidebar with Buying/Selling toggle (desktop only)
 * - Center: Conversation thread + counter-offer form
 * - Right: Product summary with action buttons (desktop only)
 *
 * Mobile: Full-screen conversation with expandable product bar at top
 *
 * Features:
 * - Manual refresh only (after user actions like accept/reject/counter)
 * - Accept/Reject offer actions
 * - Counter-offer submission
 * - Responsive layout with mobile-first design
 */

// Type definition for offer with all includes
type OfferWithRelations = Prisma.OfferGetPayload<{
  include: {
    product: {
      include: {
        images: true;
        user: true;
        brand: true;
      };
    };
    buyer: true;
    seller: true;
    counterOffers: true;
  };
}>;

interface OfferDetailClientProps {
  offer: OfferWithRelations;
  currentUserId: string;
}

export function OfferDetailClient({ offer: initialOffer, currentUserId }: OfferDetailClientProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allOffers, setAllOffers] = useState<OfferWithRelations[]>([]);

  // Manual refresh only - no auto-polling
  const { offer, loading, refetch } = useOfferUpdates({
    offerId: initialOffer.id,
    enabled: false, // Disabled - only refetch manually after user actions
    interval: 15000,
    initialOffer,
  });

  // Fetch all offers for sidebar on mount
  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const response = await fetch("/api/offers");
        if (response.ok) {
          const data = await response.json();
          setAllOffers(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Error fetching offers:", error);
      }
    };

    fetchOffers();
  }, []);

  // Determine user role
  const isUserSeller = offer.sellerId === currentUserId;

  // Offer status checks
  const isOfferActive = offer.status === "PENDING" || offer.status === "COUNTERED";

  // Get latest amount (from most recent counter-offer or initial offer)
  const latestAmount =
    offer.counterOffers.length > 0
      ? offer.counterOffers[offer.counterOffers.length - 1].amount
      : offer.amount;

  /**
   * Handle accept offer action (seller only)
   */
  const handleAccept = async () => {
    if (!isUserSeller || !isOfferActive) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/offers/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to accept offer");
      }

      // Refetch to get updated data
      await refetch();

      // Show success message or redirect to checkout
      // TODO: Add toast notification
    } catch (error) {
      console.error("Error accepting offer:", error);
      // TODO: Add error toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle reject offer action (seller only)
   */
  const handleReject = async () => {
    if (!isUserSeller || !isOfferActive) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/offers/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reject offer");
      }

      // Refetch to get updated data
      await refetch();

      // TODO: Add toast notification
    } catch (error) {
      console.error("Error rejecting offer:", error);
      // TODO: Add error toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle counter-offer submission success
   */
  const handleCounterOfferSuccess = async () => {
    // Refetch to get updated conversation
    await refetch();
  };

  return (
    <>
      {/* Mobile Product Bar (visible below $gtLg) */}
      <MobileProductBar
        product={offer.product}
        offer={offer}
        currentUserId={currentUserId}
        onAccept={handleAccept}
        onReject={handleReject}
        actionLoading={isSubmitting}
      />

      {/* Desktop Three-Column Layout */}
      <Row
        width="100%"
        maxWidth={1600}
        marginHorizontal="auto"
        gap="$lg"
        paddingHorizontal="$lg"
        paddingTop="$lg"
        paddingBottom="$2xl"
        alignItems="flex-start"
        flexDirection="column"
        $gtLg={{ flexDirection: "row" }}
      >
        {/* Left Sidebar: Offers Navigation (desktop only) */}
        <Column
          display="none"
          $gtLg={{
            display: "flex",
            flexBasis: "25%",
            flexGrow: 0,
            flexShrink: 0,
            minWidth: 280,
            paddingRight: "$lg",
          }}
        >
          <OffersSidebar offers={allOffers} currentUserId={currentUserId} />
        </Column>

        {/* Center: Conversation + Form */}
        <Column
          gap="$lg"
          width="100%"
          $gtLg={{
            flexBasis: "50%",
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 400,
            borderLeftWidth: 1,
            borderLeftColor: "$border",
            paddingLeft: "$lg",
          }}
        >
          <ConversationThread
            initialOffer={{
              id: offer.id,
              amount: offer.amount,
              message: offer.message,
              createdAt: offer.createdAt,
              buyer: offer.buyer,
              seller: offer.seller,
            }}
            counterOffers={offer.counterOffers}
            currentUserId={currentUserId}
            loading={loading}
          />

          {isOfferActive && (
            <CounterOfferForm
              offerId={offer.id}
              currentAmount={latestAmount}
              productPrice={offer.product.price}
              isUserSeller={isUserSeller}
              onSuccess={handleCounterOfferSuccess}
            />
          )}
        </Column>

        {/* Right Sidebar: Product Summary (desktop only) */}
        <Column
          display="none"
          $gtLg={{
            display: "flex",
            flexBasis: "25%",
            flexGrow: 0,
            flexShrink: 0,
            minWidth: 320,
          }}
        >
          <ProductSummaryCard
            product={offer.product}
            offer={offer}
            currentUserId={currentUserId}
            onAccept={handleAccept}
            onReject={handleReject}
            actionLoading={isSubmitting}
          />
        </Column>
      </Row>
    </>
  );
}
