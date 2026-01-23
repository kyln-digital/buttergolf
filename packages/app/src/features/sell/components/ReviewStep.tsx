"use client";

import React from "react";
import { TouchableOpacity } from "react-native";
import { Column, Row, Text, View, Image, ScrollView } from "@buttergolf/ui";
import {
  Pencil,
  Camera,
  Tag,
  FileText,
  CheckCircle,
  AlertCircle,
} from "@tamagui/lucide-icons";

import type { SellFormData, SellStep } from "../types";
import {
  FLEX_OPTIONS,
  getConditionLabel,
  calculateAverageCondition,
  mapConditionToEnum,
  CONDITION_OPTIONS,
} from "../types";

interface ReviewStepProps {
  formData: SellFormData;
  onEdit: (step: SellStep) => void;
  direction: "forward" | "backward";
}

interface ReviewSectionProps {
  title: string;
  icon: React.ReactNode;
  step: SellStep;
  onEdit: (step: SellStep) => void;
  children: React.ReactNode;
}

function ReviewSection({
  title,
  icon,
  step,
  onEdit,
  children,
}: Readonly<ReviewSectionProps>) {
  return (
    <Column
      backgroundColor="$pureWhite"
      borderRadius="$xl"
      borderWidth={2}
      borderColor="$cloudMist"
      overflow="hidden"
    >
      <Row
        paddingHorizontal="$4"
        paddingVertical="$3"
        alignItems="center"
        justifyContent="space-between"
        backgroundColor="$gray100"
        borderBottomWidth={1}
        borderBottomColor="$cloudMist"
      >
        <Row alignItems="center" gap="$2">
          {icon}
          <Text
            fontFamily="$heading"
            size="$5"
            fontWeight="700"
            color="$text"
          >
            {title}
          </Text>
        </Row>
        <TouchableOpacity
          onPress={() => onEdit(step)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={`Edit ${title.toLowerCase()}`}
        >
          <Row
            alignItems="center"
            gap="$2"
            backgroundColor="$pureWhite"
            paddingHorizontal="$3"
            paddingVertical="$2"
            borderRadius="$full"
            borderWidth={1}
            borderColor="$spicedClementine"
          >
            <Pencil size={14} color="$spicedClementine" />
            <Text size="$3" fontWeight="600" color="$spicedClementine">
              Edit
            </Text>
          </Row>
        </TouchableOpacity>
      </Row>
      <Column padding="$4">{children}</Column>
    </Column>
  );
}

export function ReviewStep({
  formData,
  onEdit,
  direction,
}: Readonly<ReviewStepProps>) {
  // Calculate overall condition from the 3 component ratings
  const avgCondition = calculateAverageCondition(
    formData.gripCondition,
    formData.headCondition,
    formData.shaftCondition,
  );
  const conditionEnum = mapConditionToEnum(avgCondition);
  const conditionLabel =
    CONDITION_OPTIONS.find((c) => c.value === conditionEnum)?.label ?? "Good";

  const formatPrice = (price: string) => {
    const num = Number.parseFloat(price);
    if (Number.isNaN(num)) return "£0.00";
    return `£${num.toFixed(2)}`;
  };

  // Helper to check if a field has a value
  const hasValue = (value: string | undefined | null): value is string =>
    Boolean(value && value.trim() !== "");

  return (
    <Column
      flex={1}
      animation="quick"
      enterStyle={{
        opacity: 0,
        x: direction === "forward" ? 50 : -50,
      }}
      exitStyle={{
        opacity: 0,
        x: direction === "forward" ? -50 : 50,
      }}
    >
      <ScrollView
        flex={1}
        contentContainerStyle={{
          padding: 20,
        }}
      >
        {/* Header Section */}
        <Column gap="$2" marginBottom="$5">
          <Row alignItems="center" gap="$2">
            <CheckCircle size={28} color="$success" />
            <Text
              fontFamily="$heading"
              size="$10"
              fontWeight="800"
              color="$text"
            >
              Almost done!
            </Text>
          </Row>
          <Text size="$5" fontWeight="400" color="$textSecondary">
            Review your listing before submitting
          </Text>
        </Column>

        <Column gap="$4">
          {/* Photos Section */}
          <ReviewSection
            title="Photos"
            icon={<Camera size={18} color="$textSecondary" />}
            step={1}
            onEdit={onEdit}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Row gap="$3">
                {formData.images.map((image, index) => (
                  <View
                    key={image.uri}
                    width={80}
                    height={80}
                    borderRadius="$lg"
                    overflow="hidden"
                    position="relative"
                  >
                    <Image
                      source={{ uri: image.uri }}
                      width="100%"
                      height="100%"
                      objectFit="cover"
                    />
                    {index === 0 && (
                      <View
                        position="absolute"
                        bottom={4}
                        left={4}
                        backgroundColor="$spicedClementine"
                        paddingHorizontal="$2"
                        paddingVertical="$1"
                        borderRadius="$sm"
                      >
                        <Text size="$1" fontWeight="700" color="$pureWhite">
                          COVER
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </Row>
            </ScrollView>
            <Text size="$3" fontWeight="500" color="$textSecondary" marginTop="$3">
              {formData.images.length} photo
              {formData.images.length === 1 ? "" : "s"} added
            </Text>
          </ReviewSection>

          {/* Details Section */}
          <ReviewSection
            title="Item Details"
            icon={<Tag size={18} color="$textSecondary" />}
            step={2}
            onEdit={onEdit}
          >
            <Column gap="$3">
              <Row justifyContent="space-between" alignItems="center">
                <Text size="$4" fontWeight="400" color="$textSecondary">
                  Category
                </Text>
                <Text size="$4" fontWeight="600" color="$text">
                  {formData.categoryName || "Not set"}
                </Text>
              </Row>

              {/* Woods Subcategory - only show if set */}
              {hasValue(formData.woodsSubcategory) && (
                <>
                  <View height={1} backgroundColor="$cloudMist" />
                  <Row justifyContent="space-between" alignItems="center">
                    <Text size="$4" fontWeight="400" color="$textSecondary">
                      Type
                    </Text>
                    <Text size="$4" fontWeight="600" color="$text">
                      {formData.woodsSubcategory}
                    </Text>
                  </Row>
                </>
              )}

              <View height={1} backgroundColor="$cloudMist" />
              <Row justifyContent="space-between" alignItems="center">
                <Text size="$4" fontWeight="400" color="$textSecondary">
                  Brand
                </Text>
                <Text size="$4" fontWeight="600" color="$text">
                  {formData.brandName || "Not set"}
                </Text>
              </Row>
              <View height={1} backgroundColor="$cloudMist" />
              <Row justifyContent="space-between" alignItems="center">
                <Text size="$4" fontWeight="400" color="$textSecondary">
                  Model
                </Text>
                <Text size="$4" fontWeight="600" color="$text">
                  {formData.modelName || "—"}
                </Text>
              </Row>

              {/* Flex - only show if set */}
              {hasValue(formData.flex) && (
                <>
                  <View height={1} backgroundColor="$cloudMist" />
                  <Row justifyContent="space-between" alignItems="center">
                    <Text size="$4" fontWeight="400" color="$textSecondary">
                      Shaft Flex
                    </Text>
                    <Text size="$4" fontWeight="600" color="$text">
                      {FLEX_OPTIONS.find((f) => f.value === formData.flex)
                        ?.label ?? formData.flex}
                    </Text>
                  </Row>
                </>
              )}

              {/* Loft - only show if set */}
              {hasValue(formData.loft) && (
                <>
                  <View height={1} backgroundColor="$cloudMist" />
                  <Row justifyContent="space-between" alignItems="center">
                    <Text size="$4" fontWeight="400" color="$textSecondary">
                      Loft
                    </Text>
                    <Text size="$4" fontWeight="600" color="$text">
                      {formData.loft}
                    </Text>
                  </Row>
                </>
              )}

              {/* Head Cover - only show if relevant category */}
              {(formData.categorySlug === "woods" ||
                formData.categorySlug === "putters") && (
                <>
                  <View height={1} backgroundColor="$cloudMist" />
                  <Row justifyContent="space-between" alignItems="center">
                    <Text size="$4" fontWeight="400" color="$textSecondary">
                      Head Cover
                    </Text>
                    <View
                      backgroundColor={
                        formData.headCoverIncluded ? "$success" : "$gray100"
                      }
                      paddingHorizontal="$3"
                      paddingVertical="$1"
                      borderRadius="$full"
                    >
                      <Text
                        size="$3"
                        fontWeight="600"
                        color={
                          formData.headCoverIncluded
                            ? "$pureWhite"
                            : "$textSecondary"
                        }
                      >
                        {formData.headCoverIncluded ? "Included" : "Not included"}
                      </Text>
                    </View>
                  </Row>
                </>
              )}

              <View height={1} backgroundColor="$cloudMist" />
              
              {/* Overall Condition Badge */}
              <Row justifyContent="space-between" alignItems="center">
                <Text size="$4" fontWeight="400" color="$textSecondary">
                  Overall Condition
                </Text>
                <View
                  backgroundColor="$lemonHaze"
                  paddingHorizontal="$3"
                  paddingVertical="$1"
                  borderRadius="$full"
                >
                  <Text size="$3" fontWeight="600" color="$burntOlive">
                    {conditionLabel}
                  </Text>
                </View>
              </Row>

              {/* Detailed Condition Ratings */}
              <Column
                gap="$2"
                marginTop="$2"
                backgroundColor="$gray100"
                borderRadius="$lg"
                padding="$3"
              >
                <Text size="$3" fontWeight="600" color="$textSecondary">
                  Condition Breakdown
                </Text>
                <Row justifyContent="space-between">
                  <Text size="$3" color="$textSecondary">
                    Grip
                  </Text>
                  <Text size="$3" fontWeight="600" color="$text">
                    {formData.gripCondition}/10 ({getConditionLabel(formData.gripCondition)})
                  </Text>
                </Row>
                <Row justifyContent="space-between">
                  <Text size="$3" color="$textSecondary">
                    Head
                  </Text>
                  <Text size="$3" fontWeight="600" color="$text">
                    {formData.headCondition}/10 ({getConditionLabel(formData.headCondition)})
                  </Text>
                </Row>
                <Row justifyContent="space-between">
                  <Text size="$3" color="$textSecondary">
                    Shaft
                  </Text>
                  <Text size="$3" fontWeight="600" color="$text">
                    {formData.shaftCondition}/10 ({getConditionLabel(formData.shaftCondition)})
                  </Text>
                </Row>
              </Column>
            </Column>
          </ReviewSection>

          {/* Listing Info Section */}
          <ReviewSection
            title="Listing Info"
            icon={<FileText size={18} color="$textSecondary" />}
            step={3}
            onEdit={onEdit}
          >
            <Column gap="$4">
              <Column gap="$1">
                <Text size="$2" fontWeight="500" color="$textSecondary">
                  TITLE
                </Text>
                <Text
                  size="$6"
                  fontWeight="600"
                  color="$text"
                  numberOfLines={2}
                >
                  {formData.title || "No title"}
                </Text>
              </Column>

              {Boolean(formData.description) && (
                <Column gap="$1">
                  <Text size="$2" fontWeight="500" color="$textSecondary">
                    DESCRIPTION
                  </Text>
                  <Text
                    size="$4"
                    fontWeight="400"
                    color="$text"
                    numberOfLines={3}
                  >
                    {formData.description}
                  </Text>
                </Column>
              )}

              <Column gap="$1">
                <Text size="$2" fontWeight="500" color="$textSecondary">
                  PRICE
                </Text>
                <Text
                  fontFamily="$heading"
                  size="$11"
                  fontWeight="800"
                  color="$spicedClementine"
                >
                  {formatPrice(formData.price)}
                </Text>
              </Column>
            </Column>
          </ReviewSection>

          {/* Terms Notice */}
          <Column
            backgroundColor="$lemonHaze"
            borderRadius="$xl"
            padding="$4"
            gap="$2"
          >
            <Row alignItems="center" gap="$2">
              <AlertCircle size={18} color="$burntOlive" />
              <Text
                fontFamily="$heading"
                size="$4"
                fontWeight="700"
                color="$burntOlive"
              >
                Before you submit
              </Text>
            </Row>
            <Text
              size="$3"
              fontWeight="400"
              color="$burntOlive"
              lineHeight={20}
            >
              By submitting this listing, you confirm that you have the right to
              sell this item and that all details are accurate. You agree to our
              terms of service and community guidelines.
            </Text>
          </Column>
        </Column>
      </ScrollView>
    </Column>
  );
}
