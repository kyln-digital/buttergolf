"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp } from "@tamagui/lucide-icons";
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

const POPULAR_SEARCHES = ["Drivers", "Titleist", "Golf balls", "Irons", "Putters"];

const linkReset = { textDecoration: "none" } as const;

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
      <Column padding="$md" gap="$sm">
        <Row alignItems="center" gap="$xs">
          <TrendingUp size={14} color="$textSecondary" />
          <Text size="$3" fontWeight="600" color="$textSecondary">
            Popular searches
          </Text>
        </Row>
        <Row gap="$sm" flexWrap="wrap">
          {POPULAR_SEARCHES.map((term) => (
            <Link
              key={term}
              href={`/listings?q=${encodeURIComponent(term)}`}
              onClick={onSelect}
              style={linkReset}
            >
              <Row
                height={32}
                paddingHorizontal="$md"
                alignItems="center"
                borderRadius="$full"
                borderWidth={1}
                borderColor="$border"
                backgroundColor="$surface"
                cursor="pointer"
                hoverStyle={{ borderColor: "$primary", backgroundColor: "$primaryLight" }}
                pressStyle={{ backgroundColor: "$primaryLight" }}
              >
                <Text size="$3" fontWeight="500" color="$text">
                  {term}
                </Text>
              </Row>
            </Link>
          ))}
        </Row>
      </Column>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Column padding="$lg" alignItems="center" gap="$sm">
        <Spinner size="md" color="$primary" />
        <Text color="$textSecondary" size="$3">
          Searching...
        </Text>
      </Column>
    );
  }

  // Error state
  if (error) {
    return (
      <Column padding="$lg" alignItems="center" gap="$xs">
        <Text size="$4" fontWeight="600" color="$error">
          Search error
        </Text>
        <Text color="$textSecondary" size="$3">
          {error}
        </Text>
      </Column>
    );
  }

  // No results
  if (results.length === 0) {
    return (
      <Column padding="$lg" alignItems="center" gap="$xs">
        <Text size="$4" fontWeight="600">
          No results found
        </Text>
        <Text color="$textSecondary" size="$3" textAlign="center">
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
        <Link
          href={`/listings?q=${encodeURIComponent(query)}`}
          onClick={onSelect}
          style={linkReset}
        >
          <Row
            borderTopWidth={1}
            borderColor="$border"
            paddingVertical="$sm"
            paddingHorizontal="$md"
            alignItems="center"
            justifyContent="center"
            gap="$xs"
            cursor="pointer"
            hoverStyle={{ backgroundColor: "$buttonGhostBgHover" }}
          >
            <Text size="$3" fontWeight="600" color="$primary">
              View all {total} results
            </Text>
            <ArrowRight size={14} color="$primary" />
          </Row>
        </Link>
      )}
    </Column>
  );
}
