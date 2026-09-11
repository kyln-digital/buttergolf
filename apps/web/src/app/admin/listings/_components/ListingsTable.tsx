"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Column, Input, Row, Text } from "@buttergolf/ui";
import { buildAdminUrl, type QueryParams } from "@/lib/admin-url";
import { adminCall } from "../../_components/admin-client";
import {
  ActionButton,
  AdminTable,
  CellLink,
  CellText,
  FilterChips,
  PageHeader,
  SearchForm,
  StatusBadge,
  UrlPagination,
} from "../../_components/AdminUi";
import { formatDay, fullName, gbp } from "../../_components/targets";

export interface ListingRow {
  id: string;
  title: string;
  price: number;
  isSold: boolean;
  isDraft: boolean;
  hiddenAt: string | null;
  hiddenReason: string | null;
  views: number;
  createdAt: string;
  category: string;
  brand: string | null;
  imageUrl: string | null;
  seller: { id: string; firstName: string; lastName: string; suspended: boolean };
  orders: number;
  favourites: number;
}

interface Filters extends QueryParams {
  q?: string;
  state?: string;
}

const BASE = "/admin/listings";

function RowActions({
  listing,
  viewer,
}: {
  listing: ListingRow;
  viewer: { canHide: boolean; canEdit: boolean };
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "hide" | "edit">("idle");
  const [reason, setReason] = useState("");
  const [title, setTitle] = useState(listing.title);
  const [price, setPrice] = useState(String(listing.price));

  const patch = async (body: unknown) => {
    const result = await adminCall(`/api/admin/listings/${listing.id}`, { method: "PATCH", body });
    if (!result.ok) return result.error;
    setMode("idle");
    router.refresh();
    return null;
  };

  if (mode === "hide") {
    return (
      <Column gap="$xs" minWidth={220}>
        <Input
          value={reason}
          onChangeText={setReason}
          placeholder="Reason (seller sees this)"
          size="$3"
        />
        <Row gap="$xs">
          <ActionButton
            label="Hide"
            tone="error"
            disabled={reason.trim().length < 5}
            onRun={() => patch({ hidden: true, reason: reason.trim() })}
          />
          <Button size="$4" butterVariant="ghost" onPress={() => setMode("idle")}>
            Cancel
          </Button>
        </Row>
      </Column>
    );
  }

  if (mode === "edit") {
    const priceNumber = Number.parseFloat(price);
    return (
      <Column gap="$xs" minWidth={220}>
        <Input value={title} onChangeText={setTitle} placeholder="Title" size="$3" />
        <Input
          value={price}
          onChangeText={setPrice}
          placeholder="Price £"
          size="$3"
          inputMode="decimal"
        />
        <Row gap="$xs">
          <ActionButton
            label="Save"
            variant="primary"
            disabled={title.trim().length < 3 || !Number.isFinite(priceNumber) || priceNumber <= 0}
            onRun={() => patch({ title: title.trim(), price: priceNumber })}
          />
          <Button size="$4" butterVariant="ghost" onPress={() => setMode("idle")}>
            Cancel
          </Button>
        </Row>
      </Column>
    );
  }

  return (
    <Row gap="$xs" flexWrap="wrap">
      {viewer.canHide &&
        (listing.hiddenAt ? (
          <ActionButton
            label="Unhide"
            confirm="Make this listing public again?"
            onRun={() => patch({ hidden: false })}
          />
        ) : (
          <Button
            size="$4"
            butterVariant="secondary"
            color="$error"
            onPress={() => setMode("hide")}
          >
            Hide
          </Button>
        ))}
      {viewer.canEdit && (
        <Button size="$4" butterVariant="ghost" onPress={() => setMode("edit")}>
          Edit
        </Button>
      )}
    </Row>
  );
}

export function ListingsTable({
  listings,
  filters,
  page,
  totalPages,
  total,
  viewer,
}: {
  listings: ListingRow[];
  filters: Filters;
  page: number;
  totalPages: number;
  total: number;
  viewer: { canHide: boolean; canEdit: boolean };
}) {
  const chip = (state: string | undefined, label: string) => ({
    label,
    active: (filters.state ?? undefined) === state,
    href: buildAdminUrl(BASE, { ...filters, state, page: undefined }),
  });

  return (
    <Column gap="$lg">
      <PageHeader
        title="Listings"
        description="Search by title, listing id, seller id or seller email. Hiding a listing takes it off the site until a staff member unhides it."
      />

      <SearchForm
        basePath={BASE}
        params={filters}
        initialValue={filters.q}
        placeholder="Search listings"
      />

      <FilterChips
        options={[
          chip(undefined, "All"),
          chip("live", "Live"),
          chip("hidden", "Hidden by staff"),
          chip("draft", "Drafts"),
          chip("sold", "Sold"),
        ]}
      />

      <AdminTable
        rows={listings}
        rowKey={(listing) => listing.id}
        emptyText="No listings match."
        columns={[
          {
            key: "title",
            label: "Listing",
            flex: 3,
            render: (listing) => (
              <Column gap={0}>
                <Link
                  href={`/products/${listing.id}`}
                  target="_blank"
                  style={{ textDecoration: "none" }}
                >
                  <Text size="$4" color="$primary" fontWeight="600" numberOfLines={1}>
                    {listing.title}
                  </Text>
                </Link>
                <CellText secondary>
                  {[listing.brand, listing.category].filter(Boolean).join(" · ")} · {listing.views}{" "}
                  views · {listing.favourites} saves
                </CellText>
                {listing.hiddenAt && listing.hiddenReason && (
                  <Text size="$3" color="$error" numberOfLines={1}>
                    Hidden: {listing.hiddenReason}
                  </Text>
                )}
              </Column>
            ),
          },
          {
            key: "seller",
            label: "Seller",
            flex: 1.5,
            render: (listing) => (
              <Column gap={0}>
                <CellLink href={`/admin/users/${listing.seller.id}`}>
                  {fullName(listing.seller)}
                </CellLink>
                {listing.seller.suspended && <StatusBadge value="SUSPENDED" />}
              </Column>
            ),
          },
          {
            key: "price",
            label: "Price",
            width: 90,
            render: (listing) => <CellText>{gbp(listing.price)}</CellText>,
          },
          {
            key: "state",
            label: "State",
            width: 120,
            render: (listing) => (
              <Row gap="$xs" flexWrap="wrap">
                {listing.hiddenAt && <StatusBadge value="HIDDEN" />}
                {listing.isDraft && <StatusBadge value="DRAFT" />}
                {listing.isSold && <StatusBadge value="SOLD" />}
                {!listing.hiddenAt && !listing.isDraft && !listing.isSold && (
                  <StatusBadge value="LIVE" />
                )}
              </Row>
            ),
          },
          {
            key: "when",
            label: "Listed",
            width: 110,
            render: (listing) => <CellText secondary>{formatDay(listing.createdAt)}</CellText>,
          },
          {
            key: "actions",
            label: "",
            width: 240,
            render: (listing) => <RowActions listing={listing} viewer={viewer} />,
          },
        ]}
      />

      <UrlPagination
        basePath={BASE}
        params={filters}
        page={page}
        totalPages={totalPages}
        total={total}
      />
    </Column>
  );
}
