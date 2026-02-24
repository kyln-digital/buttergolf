"use client";

import React, { useState, useCallback } from "react";
import { Column, Row, Text, Button, View } from "@buttergolf/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, X } from "@tamagui/lucide-icons";

import type { SellFormData, SellStep, Category, Brand, Model, ImageData } from "./types";
import { SELL_STEPS } from "./types";
import { PhotoStep } from "./components/PhotoStep";
import { DetailsStep } from "./components/DetailsStep";
import { ListingStep } from "./components/ListingStep";
import { ReviewStep } from "./components/ReviewStep";
import { StepIndicator } from "./components/StepIndicator";

export interface SellScreenProps {
  /** Called when user is not authenticated - should redirect to sign-in */
  onRequireAuth?: () => void;
  /** Whether user is authenticated */
  isAuthenticated?: boolean;
  /** Called to fetch categories */
  onFetchCategories?: () => Promise<Category[]>;
  /** Called to search brands */
  onSearchBrands?: (query: string) => Promise<Brand[]>;
  /** Called to search models for a brand */
  onSearchModels?: (brandId: string, query: string) => Promise<Model[]>;
  /** Called to upload an image to CDN, returns the URL. isFirstImage triggers background removal. */
  onUploadImage?: (image: ImageData, isFirstImage: boolean) => Promise<string>;
  /** Platform-specific function to pick images from gallery */
  onPickImages?: () => Promise<ImageData[]>;
  /** Platform-specific function to take a photo with camera */
  onTakePhoto?: () => Promise<ImageData | null>;
  /** Called to submit the listing */
  onSubmitListing?: (data: SellFormData) => Promise<{ id: string }>;
  /** Called when user wants to go back/cancel */
  onClose?: () => void;
  /** Called on successful submission */
  onSuccess?: (productId: string) => void;
}

const initialFormData: SellFormData = {
  images: [],
  categoryId: "",
  categoryName: "",
  categorySlug: "",
  brandId: "",
  brandName: "",
  modelId: "",
  modelName: "",
  // Golf-specific fields (conditional)
  flex: "",
  loft: "",
  woodsSubcategory: "",
  headCoverIncluded: false,
  // Condition ratings (1-10 scale, default to 7 = Good)
  gripCondition: 7,
  headCondition: 7,
  shaftCondition: 7,
  // Listing info
  title: "",
  description: "",
  price: "",
};

export function SellScreen({
  onRequireAuth,
  isAuthenticated = false,
  onFetchCategories,
  onSearchBrands,
  onSearchModels,
  onUploadImage,
  onPickImages,
  onTakePhoto,
  onSubmitListing,
  onClose,
  onSuccess,
}: Readonly<SellScreenProps>) {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState<SellStep>(1);
  const [formData, setFormData] = useState<SellFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  // Update form data helper
  const updateFormData = useCallback((updates: Partial<SellFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Navigation handlers
  const goToNextStep = useCallback(() => {
    if (currentStep < 4) {
      setDirection("forward");
      setCurrentStep((prev) => (prev + 1) as SellStep);
    }
  }, [currentStep]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setDirection("backward");
      setCurrentStep((prev) => (prev - 1) as SellStep);
    }
  }, [currentStep]);

  // Submit handler - checks auth before submitting
  const handleSubmit = useCallback(async () => {
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }

    if (!onSubmitListing) {
      setError("Submission not configured");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await onSubmitListing(formData);
      onSuccess?.(result.id);
    } catch (err) {
      console.error("Failed to submit listing:", err);
      setError(err instanceof Error ? err.message : "Failed to submit listing");
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, isAuthenticated, onRequireAuth, onSubmitListing, onSuccess]);

  // Validation for each step
  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 1:
        return formData.images.length > 0;
      case 2:
        // Category and brand are required
        // Condition sliders have default values so no explicit check needed
        return formData.categoryId !== "" && formData.brandId !== "";
      case 3:
        return (
          formData.title.trim() !== "" &&
          formData.description.trim() !== "" &&
          formData.price !== "" &&
          Number.parseFloat(formData.price) > 0
        );
      case 4:
        return true;
      default:
        return false;
    }
  }, [currentStep, formData]);

  // SELL_STEPS always has 4 elements (steps 1-4), so this is safe
  const stepInfo = SELL_STEPS[currentStep - 1]!;

  return (
    <Column
      flex={1}
      backgroundColor="$pureWhite"
      paddingTop={insets.top}
      paddingBottom={insets.bottom}
    >
      {/* Header - Refined mobile design */}
      <Row
        paddingHorizontal="$4"
        paddingVertical="$4"
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth={1}
        borderBottomColor="$cloudMist"
        backgroundColor="$pureWhite"
      >
        {/* Back/Close Button */}
        <Button
          size="$4"
          circular
          backgroundColor="transparent"
          pressStyle={{ backgroundColor: "$gray100" }}
          onPress={currentStep === 1 ? onClose : goToPreviousStep}
          aria-label={currentStep === 1 ? "Close" : "Go back"}
        >
          {currentStep === 1 ? (
            <X size={24} color="$pureWhite" />
          ) : (
            <ArrowLeft size={24} color="$pureWhite" />
          )}
        </Button>

        {/* Title & Step Counter */}
        <Column alignItems="center" gap="$1">
          <Text fontFamily="$heading" size="$7" fontWeight="700" color="$text">
            {stepInfo.title}
          </Text>
          <Text size="$3" fontWeight="500" color="$textSecondary">
            Step {currentStep} of 4
          </Text>
        </Column>

        {/* Spacer to balance layout */}
        <View width={44} height={44} />
      </Row>

      {/* Step Indicator - Progress bar */}
      <StepIndicator currentStep={currentStep} totalSteps={4} />

      {/* Error Banner */}
      {error && (
        <Row
          backgroundColor="$vanillaCream"
          paddingHorizontal="$4"
          paddingVertical="$3"
          marginHorizontal="$4"
          marginTop="$3"
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$error"
        >
          <Text color="$error" size="$4" fontWeight="500">
            {error}
          </Text>
        </Row>
      )}

      {/* Step Content */}
      <Column flex={1}>
        {currentStep === 1 && (
          <PhotoStep
            key="photo"
            images={formData.images}
            onImagesChange={(images) => updateFormData({ images })}
            onUploadImage={onUploadImage}
            onPickImages={onPickImages}
            onTakePhoto={onTakePhoto}
            direction={direction}
          />
        )}
        {currentStep === 2 && (
          <DetailsStep
            key="details"
            formData={formData}
            onUpdate={updateFormData}
            onFetchCategories={onFetchCategories}
            onSearchBrands={onSearchBrands}
            onSearchModels={onSearchModels}
            direction={direction}
          />
        )}
        {currentStep === 3 && (
          <ListingStep
            key="listing"
            formData={formData}
            onUpdate={updateFormData}
            direction={direction}
          />
        )}
        {currentStep === 4 && (
          <ReviewStep
            key="review"
            formData={formData}
            onEdit={(step) => {
              setDirection("backward");
              setCurrentStep(step);
            }}
            direction={direction}
          />
        )}
      </Column>

      {/* Bottom Action Bar */}
      <Column
        paddingHorizontal="$4"
        paddingVertical="$4"
        paddingBottom={Math.max(insets.bottom, 16)}
        borderTopWidth={1}
        borderTopColor="$cloudMist"
        backgroundColor="$pureWhite"
      >
        {currentStep < 4 ? (
          <Button
            size="$5"
            height={56}
            backgroundColor={canProceed() ? "$spicedClementine" : "$cloudMist"}
            pressStyle={{
              backgroundColor: canProceed() ? "$primary" : "$cloudMist",
            }}
            borderRadius="$full"
            onPress={goToNextStep}
            disabled={!canProceed()}
          >
            <Text fontFamily="$heading" size="$6" fontWeight="700" color="$pureWhite">
              Continue
            </Text>
          </Button>
        ) : (
          <Button
            size="$5"
            height={56}
            backgroundColor={isSubmitting ? "$cloudMist" : "$spicedClementine"}
            pressStyle={{ backgroundColor: "$primary" }}
            borderRadius="$full"
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text
              fontFamily="$heading"
              size="$6"
              fontWeight="700"
              color={isSubmitting ? "$textSecondary" : "$pureWhite"}
            >
              {isSubmitting ? "Submitting..." : "List Item"}
            </Text>
          </Button>
        )}
      </Column>
    </Column>
  );
}
