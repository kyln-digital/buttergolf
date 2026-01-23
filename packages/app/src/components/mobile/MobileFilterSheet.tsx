"use client";

import React, { useState, useEffect } from "react";
import { Animated, Dimensions, Modal, Pressable } from "react-native";
import { Column, Row, Text, Button, ScrollView } from "@buttergolf/ui";
import { X, ChevronDown, ChevronUp, Check } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Simple checkbox component for React Native
 * (The @buttergolf/ui Checkbox uses HTML elements that don't work on native)
 */
function NativeCheckbox({
  checked,
  onPress,
  size = 20,
}: {
  checked: boolean;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable onPress={onPress}>
      <Column
        width={size}
        height={size}
        borderWidth={2}
        borderColor={checked ? "$primary" : "$border"}
        borderRadius="$xs"
        backgroundColor={checked ? "$primary" : "$surface"}
        alignItems="center"
        justifyContent="center"
      >
        {checked && <Check size={size - 6} color="white" strokeWidth={3} />}
      </Column>
    </Pressable>
  );
}

const CONDITIONS = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like New" },
  { value: "EXCELLENT", label: "Excellent" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
] as const;

export interface FilterState {
  conditions: string[];
  minPrice: number | null;
  maxPrice: number | null;
  sortBy: string;
}

export interface MobileFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  onApplyFilters: (filters: FilterState) => void;
  onClearFilters: () => void;
}

/**
 * Mobile filter sheet that drops down from the top of the screen.
 * Contains condition filters, price range, and sort options.
 */
export function MobileFilterSheet({
  visible,
  onClose,
  filters,
  onApplyFilters,
  onClearFilters,
}: Readonly<MobileFilterSheetProps>) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get("window");
  
  // Local state for editing filters
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);
  const [conditionExpanded, setConditionExpanded] = useState(true);
  const [priceExpanded, setPriceExpanded] = useState(true);
  const [sortExpanded, setSortExpanded] = useState(true);
  
  // Animation values - using useState to avoid ref access during render issues
  const [slideAnim] = useState(() => new Animated.Value(-screenHeight));
  const [backdropAnim] = useState(() => new Animated.Value(0));

  // Sync local state when filters prop changes
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 150,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -screenHeight,
          useNativeDriver: true,
          damping: 20,
          stiffness: 150,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, screenHeight, slideAnim, backdropAnim]);

  const handleConditionToggle = (condition: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      conditions: prev.conditions.includes(condition)
        ? prev.conditions.filter((c) => c !== condition)
        : [...prev.conditions, condition],
    }));
  };

  const handleSortChange = (sortBy: string) => {
    setLocalFilters((prev) => ({ ...prev, sortBy }));
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleClear = () => {
    const clearedFilters: FilterState = {
      conditions: [],
      minPrice: null,
      maxPrice: null,
      sortBy: "newest",
    };
    setLocalFilters(clearedFilters);
    onClearFilters();
  };

  const activeFilterCount =
    localFilters.conditions.length +
    (localFilters.minPrice !== null ? 1 : 0) +
    (localFilters.maxPrice !== null ? 1 : 0) +
    (localFilters.sortBy !== "newest" ? 1 : 0);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          opacity: backdropAnim,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Filter Sheet */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          maxHeight: screenHeight * 0.85,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <Column
          backgroundColor="$background"
          borderBottomLeftRadius="$2xl"
          borderBottomRightRadius="$2xl"
          paddingTop={insets.top}
          shadowColor="rgba(0, 0, 0, 0.25)"
          shadowOffset={{ width: 0, height: 4 }}
          shadowOpacity={1}
          shadowRadius={12}
          elevation={10}
        >
          {/* Header */}
          <Row
            paddingHorizontal="$4"
            paddingVertical="$3"
            alignItems="center"
            justifyContent="space-between"
            borderBottomWidth={1}
            borderBottomColor="$border"
          >
            <Text size="$6" fontWeight="700" color="$text">
              Filters
              {activeFilterCount > 0 && (
                <Text color="$primary"> ({activeFilterCount})</Text>
              )}
            </Text>
            <Column
              width={40}
              height={40}
              alignItems="center"
              justifyContent="center"
              pressStyle={{ opacity: 0.7 }}
              onPress={onClose}
            >
              <X size={24} color="$text" />
            </Column>
          </Row>

          {/* Scrollable Content */}
          <ScrollView
            style={{ maxHeight: screenHeight * 0.6 }}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {/* Sort By Section */}
            <Column paddingHorizontal="$4" paddingTop="$4">
              <Pressable onPress={() => setSortExpanded(!sortExpanded)}>
                <Row alignItems="center" justifyContent="space-between" paddingVertical="$2">
                  <Text size="$5" fontWeight="600" color="$text">
                    Sort By
                  </Text>
                  {sortExpanded ? (
                    <ChevronUp size={20} color="$textSecondary" />
                  ) : (
                    <ChevronDown size={20} color="$textSecondary" />
                  )}
                </Row>
              </Pressable>
              {sortExpanded && (
                <Column gap="$2" paddingTop="$2">
                  {SORT_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => handleSortChange(option.value)}
                    >
                      <Row
                        paddingVertical="$2"
                        paddingHorizontal="$3"
                        backgroundColor={
                          localFilters.sortBy === option.value
                            ? "$primaryLight"
                            : "transparent"
                        }
                        borderRadius="$md"
                        alignItems="center"
                        gap="$2"
                      >
                        <Column
                          width={20}
                          height={20}
                          borderRadius="$full"
                          borderWidth={2}
                          borderColor={
                            localFilters.sortBy === option.value
                              ? "$primary"
                              : "$border"
                          }
                          alignItems="center"
                          justifyContent="center"
                        >
                          {localFilters.sortBy === option.value && (
                            <Column
                              width={10}
                              height={10}
                              borderRadius="$full"
                              backgroundColor="$primary"
                            />
                          )}
                        </Column>
                        <Text
                          size="$4"
                          color={
                            localFilters.sortBy === option.value
                              ? "$primary"
                              : "$text"
                          }
                          fontWeight={
                            localFilters.sortBy === option.value ? "600" : "400"
                          }
                        >
                          {option.label}
                        </Text>
                      </Row>
                    </Pressable>
                  ))}
                </Column>
              )}
            </Column>

            {/* Divider */}
            <Column height={1} backgroundColor="$border" marginVertical="$3" marginHorizontal="$4" />

            {/* Condition Section */}
            <Column paddingHorizontal="$4">
              <Pressable onPress={() => setConditionExpanded(!conditionExpanded)}>
                <Row alignItems="center" justifyContent="space-between" paddingVertical="$2">
                  <Text size="$5" fontWeight="600" color="$text">
                    Condition
                  </Text>
                  {conditionExpanded ? (
                    <ChevronUp size={20} color="$textSecondary" />
                  ) : (
                    <ChevronDown size={20} color="$textSecondary" />
                  )}
                </Row>
              </Pressable>
              {conditionExpanded && (
                <Column gap="$1" paddingTop="$2">
                  {CONDITIONS.map((condition) => (
                    <Pressable
                      key={condition.value}
                      onPress={() => handleConditionToggle(condition.value)}
                    >
                      <Row
                        paddingVertical="$2"
                        alignItems="center"
                        gap="$3"
                      >
                        <NativeCheckbox
                          checked={localFilters.conditions.includes(condition.value)}
                          onPress={() => handleConditionToggle(condition.value)}
                        />
                        <Text size="$4" color="$text">
                          {condition.label}
                        </Text>
                      </Row>
                    </Pressable>
                  ))}
                </Column>
              )}
            </Column>

            {/* Divider */}
            <Column height={1} backgroundColor="$border" marginVertical="$3" marginHorizontal="$4" />

            {/* Price Range Section */}
            <Column paddingHorizontal="$4">
              <Pressable onPress={() => setPriceExpanded(!priceExpanded)}>
                <Row alignItems="center" justifyContent="space-between" paddingVertical="$2">
                  <Text size="$5" fontWeight="600" color="$text">
                    Price Range
                  </Text>
                  {priceExpanded ? (
                    <ChevronUp size={20} color="$textSecondary" />
                  ) : (
                    <ChevronDown size={20} color="$textSecondary" />
                  )}
                </Row>
              </Pressable>
              {priceExpanded && (
                <Row gap="$3" paddingTop="$2" alignItems="center">
                  <Column flex={1}>
                    <Text size="$3" color="$textSecondary" marginBottom="$1">
                      Min
                    </Text>
                    <Row
                      height={44}
                      backgroundColor="$surface"
                      borderRadius="$md"
                      borderWidth={1}
                      borderColor="$border"
                      paddingHorizontal="$3"
                      alignItems="center"
                    >
                      <Text size="$4" color="$textSecondary">
                        £
                      </Text>
                      <Pressable style={{ flex: 1, height: "100%", justifyContent: "center" }}>
                        <Text
                          size="$4"
                          color={localFilters.minPrice !== null ? "$text" : "$textMuted"}
                          paddingLeft="$1"
                        >
                          {localFilters.minPrice !== null ? localFilters.minPrice.toString() : "0"}
                        </Text>
                      </Pressable>
                    </Row>
                  </Column>
                  <Text color="$textSecondary" paddingTop="$5">
                    –
                  </Text>
                  <Column flex={1}>
                    <Text size="$3" color="$textSecondary" marginBottom="$1">
                      Max
                    </Text>
                    <Row
                      height={44}
                      backgroundColor="$surface"
                      borderRadius="$md"
                      borderWidth={1}
                      borderColor="$border"
                      paddingHorizontal="$3"
                      alignItems="center"
                    >
                      <Text size="$4" color="$textSecondary">
                        £
                      </Text>
                      <Pressable style={{ flex: 1, height: "100%", justifyContent: "center" }}>
                        <Text
                          size="$4"
                          color={localFilters.maxPrice !== null ? "$text" : "$textMuted"}
                          paddingLeft="$1"
                        >
                          {localFilters.maxPrice !== null ? localFilters.maxPrice.toString() : "Any"}
                        </Text>
                      </Pressable>
                    </Row>
                  </Column>
                </Row>
              )}
            </Column>
          </ScrollView>

          {/* Footer Buttons */}
          <Row
            paddingHorizontal="$4"
            paddingVertical="$4"
            gap="$3"
            borderTopWidth={1}
            borderTopColor="$border"
          >
            <Button
              flex={1}
              size="$5"
              chromeless
              borderWidth={1}
              borderColor="$border"
              onPress={handleClear}
            >
              Clear All
            </Button>
            <Button
              flex={2}
              butterVariant="primary"
              size="$5"
              onPress={handleApply}
            >
              Apply Filters
            </Button>
          </Row>
        </Column>
      </Animated.View>
    </Modal>
  );
}
