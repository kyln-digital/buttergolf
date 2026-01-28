"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Column, Text, Spinner, ScrollView, Row } from "@buttergolf/ui";
import type { ProductCardData } from "@buttergolf/app";
import { SearchResultItem } from "./SearchResultItem";

interface SearchDropdownProps {
  query: string;
  onSelect?: () => void;
}

interface SearchResponse {
  products: ProductCardData[];
  total: number;
  categories: string[];
}

export function SearchDropdown({ query, onSelect }: SearchDropdownProps) {
  const [results, setResults] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    // Don't search if query is too short
    if (query.trim().length < 2) {
      setResults([]);
      setTotal(0);
      return;
    }

    const abortController = new AbortController();

    const fetchResults = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=10`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch search results");
        }

        const data: SearchResponse = await response.json();
        setResults(data.products);
        setTotal(data.total);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchResults();

    return () => {
      abortController.abort();
    };
  }, [query]);

  // Empty state - waiting for input
  if (query.trim().length < 2) {
    return (
      <Column padding="$4" gap="$3">
        <Text size="$3" weight="medium" {...{ color: "$textMuted" }}>
          Type to search for golf equipment...
        </Text>
        <Column gap="$2">
          <Text size="$2" {...{ color: "$textTertiary" }}>
            Popular searches:
          </Text>
          <Row gap="$2" flexWrap="wrap">
            {["Drivers", "Titleist", "Golf Balls", "Irons", "Putters"].map((term) => (
              <Link key={term} href={`/listings?q=${term}`} onClick={onSelect}>
                <Text
                  size="$2"
                  {...{ color: "$primary" }}
                  hoverStyle={{ textDecoration: "underline" }}
                  cursor="pointer"
                >
                  {term}
                </Text>
              </Link>
            ))}
          </Row>
        </Column>
      </Column>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Column padding="$6" alignItems="center" gap="$3">
        <Spinner size="md" color="$primary" />
        <Text {...{ color: "$textMuted" }} size="$3">
          Searching...
        </Text>
      </Column>
    );
  }

  // Error state
  if (error) {
    return (
      <Column padding="$6" alignItems="center" gap="$2">
        <Text size="$4" weight="semibold" {...{ color: "$error" }}>
          Search Error
        </Text>
        <Text {...{ color: "$textMuted" }} size="$3">
          {error}
        </Text>
      </Column>
    );
  }

  // No results
  if (results.length === 0) {
    return (
      <Column padding="$6" alignItems="center" gap="$2">
        <Text size="$4" weight="semibold">
          No results found
        </Text>
        <Text {...{ color: "$textMuted" }} size="$3" align="center">
          Try a different search term or browse our categories
        </Text>
      </Column>
    );
  }

  // Results
  return (
    <Column width="100%" overflow="hidden">
      <ScrollView maxHeight={400}>
        <Column>
          {results.map((product) => (
            <SearchResultItem key={product.id} product={product} onSelect={onSelect} />
          ))}
        </Column>
      </ScrollView>

      {/* Footer with "View all results" link */}
      {total > results.length && (
        <Column
          borderTopWidth={1}
          borderColor="$border"
          padding="$3"
          backgroundColor="$backgroundHover"
        >
          <Link href={`/listings?q=${encodeURIComponent(query)}`} onClick={onSelect}>
            <Text
              size="$3"
              weight="medium"
              {...{ color: "$primary" }}
              align="center"
              hoverStyle={{ textDecoration: "underline" }}
              cursor="pointer"
            >
              View all {total} results →
            </Text>
          </Link>
        </Column>
      )}
    </Column>
  );
}
