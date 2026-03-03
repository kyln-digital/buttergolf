"use client";

import React, { useState, useEffect, useCallback } from "react";
import { TouchableOpacity, Keyboard } from "react-native";
import {
  Column,
  Row,
  Text,
  View,
  Input,
  ScrollView,
  Spinner,
  Slider,
  Switch,
} from "@buttergolf/ui";
import {
  ChevronDown,
  Check,
  Search,
  X,
  Tag,
  Award,
  Layers,
  Gauge,
  CircleDot,
  Crosshair,
  Lightbulb,
} from "@tamagui/lucide-icons";

import type { SellFormData, Category, Brand, Model } from "../types";
import {
  FLEX_OPTIONS,
  LOFT_OPTIONS_WOODS,
  LOFT_OPTIONS_WEDGES,
  WOODS_SUBCATEGORIES,
  getConditionLabel,
} from "../types";

interface DetailsStepProps {
  formData: SellFormData;
  onUpdate: (updates: Partial<SellFormData>) => void;
  onFetchCategories?: () => Promise<Category[]>;
  onSearchBrands?: (query: string) => Promise<Brand[]>;
  onSearchModels?: (brandId: string, query: string) => Promise<Model[]>;
  direction: "forward" | "backward";
}

type ActivePicker = "category" | "brand" | "model" | "flex" | "loft" | "woodsSubcategory" | null;

export function DetailsStep({
  formData,
  onUpdate,
  onFetchCategories,
  onSearchBrands,
  onSearchModels,
  direction,
}: Readonly<DetailsStepProps>) {
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    if (onFetchCategories) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(true);
      onFetchCategories()
        .then(setCategories)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [onFetchCategories]);

  // Search brands when query changes
  useEffect(() => {
    if (activePicker === "brand" && searchQuery && onSearchBrands) {
      const timeoutId = setTimeout(() => {
        setIsLoading(true);
        onSearchBrands(searchQuery)
          .then(setBrands)
          .catch(console.error)
          .finally(() => setIsLoading(false));
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [activePicker, searchQuery, onSearchBrands]);

  // Search models when brand is selected and query changes
  useEffect(() => {
    if (activePicker === "model" && formData.brandId && onSearchModels) {
      const timeoutId = setTimeout(() => {
        setIsLoading(true);
        onSearchModels(formData.brandId, searchQuery)
          .then(setModels)
          .catch(console.error)
          .finally(() => setIsLoading(false));
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [activePicker, formData.brandId, searchQuery, onSearchModels]);

  // ============================================================================
  // Conditional field logic - based on category slug
  // ============================================================================

  const shouldShowFlex = (): boolean => {
    return formData.categorySlug === "woods" || formData.categorySlug === "irons";
  };

  const shouldShowLoft = (): boolean => {
    return formData.categorySlug === "woods" || formData.categorySlug === "wedges";
  };

  const getLoftOptions = () => {
    return formData.categorySlug === "wedges" ? LOFT_OPTIONS_WEDGES : LOFT_OPTIONS_WOODS;
  };

  const shouldShowWoodsSubcategory = (): boolean => {
    return formData.categorySlug === "woods";
  };

  const shouldShowHeadCover = (): boolean => {
    return formData.categorySlug === "woods" || formData.categorySlug === "putters";
  };

  // ============================================================================
  // Picker handlers
  // ============================================================================

  const openPicker = useCallback((picker: ActivePicker) => {
    Keyboard.dismiss();
    setSearchQuery("");
    setActivePicker(picker);
  }, []);

  const closePicker = useCallback(() => {
    setActivePicker(null);
    setSearchQuery("");
  }, []);

  const selectCategory = useCallback(
    (category: Category) => {
      onUpdate({
        categoryId: category.id,
        categoryName: category.name,
        categorySlug: category.slug,
        // Reset conditional fields when category changes
        flex: "",
        loft: "",
        woodsSubcategory: "",
        headCoverIncluded: false,
      });
      closePicker();
    },
    [onUpdate, closePicker]
  );

  const selectBrand = useCallback(
    (brand: Brand) => {
      onUpdate({
        brandId: brand.id,
        brandName: brand.name,
        modelId: "",
        modelName: "",
      });
      closePicker();
    },
    [onUpdate, closePicker]
  );

  const selectModel = useCallback(
    (model: Model) => {
      onUpdate({
        modelId: model.id,
        modelName: model.name,
      });
      closePicker();
    },
    [onUpdate, closePicker]
  );

  const selectFlex = useCallback(
    (flex: string) => {
      onUpdate({ flex });
      closePicker();
    },
    [onUpdate, closePicker]
  );

  const selectLoft = useCallback(
    (loft: string) => {
      onUpdate({ loft });
      closePicker();
    },
    [onUpdate, closePicker]
  );

  const selectWoodsSubcategory = useCallback(
    (subcategory: string) => {
      onUpdate({ woodsSubcategory: subcategory });
      closePicker();
    },
    [onUpdate, closePicker]
  );

  // Get icon for field type
  const getFieldIcon = (field: string, size: number = 20) => {
    switch (field) {
      case "category":
        return <Tag size={size} color="$textSecondary" />;
      case "brand":
        return <Award size={size} color="$textSecondary" />;
      case "model":
        return <Layers size={size} color="$textSecondary" />;
      case "flex":
        return <Gauge size={size} color="$textSecondary" />;
      case "loft":
        return <Crosshair size={size} color="$textSecondary" />;
      case "woodsSubcategory":
        return <CircleDot size={size} color="$textSecondary" />;
      default:
        return null;
    }
  };

  const renderPickerButton = (
    label: string,
    value: string,
    placeholder: string,
    pickerType: ActivePicker,
    disabled = false,
    required = true
  ) => (
    <Column gap="$2">
      <Row alignItems="center" gap="$1">
        <Text size="$4" fontWeight="600" color="$text">
          {label}
        </Text>
        {required && (
          <Text size="$4" fontWeight="600" color="$error">
            *
          </Text>
        )}
      </Row>
      <TouchableOpacity
        onPress={() => !disabled && openPicker(pickerType)}
        disabled={disabled}
        accessibilityLabel={`Select ${label.toLowerCase()}`}
        style={{ opacity: disabled ? 0.5 : 1 }}
      >
        <Row
          backgroundColor={disabled ? "$gray100" : "$pureWhite"}
          borderWidth={2}
          borderColor={value ? "$spicedClementine" : "$cloudMist"}
          borderRadius="$xl"
          paddingHorizontal="$4"
          paddingVertical="$4"
          alignItems="center"
          gap="$3"
        >
          {getFieldIcon(pickerType ?? "")}
          <Text
            flex={1}
            color={value ? "$text" : "$textSecondary"}
            size="$6"
            fontWeight={value ? "500" : "400"}
          >
            {value || placeholder}
          </Text>
          <ChevronDown size={20} color="$textSecondary" />
        </Row>
      </TouchableOpacity>
    </Column>
  );

  // ============================================================================
  // Condition Slider Component
  // ============================================================================

  const renderConditionSlider = (label: string, value: number, onChange: (val: number) => void) => (
    <Column gap="$2">
      <Row justifyContent="space-between" alignItems="center">
        <Text size="$4" fontWeight="600" color="$text">
          {label}
        </Text>
        <Row
          backgroundColor="$lemonHaze"
          paddingHorizontal="$3"
          paddingVertical="$1"
          borderRadius="$full"
        >
          <Text size="$4" fontWeight="600" color="$burntOlive">
            {value} - {getConditionLabel(value)}
          </Text>
        </Row>
      </Row>
      <Slider
        min={1}
        max={10}
        step={1}
        value={[value]}
        onValueChange={(values) => {
          if (values[0] !== undefined) {
            onChange(values[0]);
          }
        }}
      >
        <Slider.Track>
          <Slider.TrackActive />
        </Slider.Track>
        <Slider.Thumb index={0} />
      </Slider>
      <Row justifyContent="space-between" paddingHorizontal="$1">
        <Text size="$2" color="$textSecondary">
          Poor
        </Text>
        <Text size="$2" color="$textSecondary">
          Like New
        </Text>
      </Row>
    </Column>
  );

  // Picker Modal Content
  const renderPickerContent = () => {
    if (!activePicker) return null;

    let title = "";
    let items: { id: string; name: string }[] = [];
    let onSelect: (item: { id: string; name: string }) => void = () => {};
    let showSearch = false;
    let selectedId = "";

    switch (activePicker) {
      case "category":
        title = "Category";
        items = categories;
        onSelect = (item) => selectCategory(item as Category);
        selectedId = formData.categoryId;
        break;
      case "brand":
        title = "Brand";
        items = brands;
        onSelect = (item) => selectBrand(item as Brand);
        showSearch = true;
        selectedId = formData.brandId;
        break;
      case "model":
        title = "Model";
        items = models;
        onSelect = (item) => selectModel(item as Model);
        showSearch = true;
        selectedId = formData.modelId;
        break;
      case "flex":
        title = "Shaft Flex";
        items = FLEX_OPTIONS.filter((f) => f.value !== "").map((f) => ({
          id: f.value,
          name: f.label,
        }));
        onSelect = (item) => selectFlex(item.id);
        selectedId = formData.flex;
        break;
      case "loft":
        title = "Loft";
        items = getLoftOptions()
          .filter((l) => l.value !== "")
          .map((l) => ({
            id: l.value,
            name: l.label,
          }));
        onSelect = (item) => selectLoft(item.id);
        selectedId = formData.loft;
        break;
      case "woodsSubcategory":
        title = "Wood Type";
        items = WOODS_SUBCATEGORIES.map((s) => ({
          id: s.value,
          name: s.label,
        }));
        onSelect = (item) => selectWoodsSubcategory(item.id);
        selectedId = formData.woodsSubcategory;
        break;
    }

    return (
      <Column
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        backgroundColor="$pureWhite"
        zIndex={100}
      >
        {/* Picker Header */}
        <Row
          paddingHorizontal="$4"
          paddingVertical="$4"
          alignItems="center"
          justifyContent="space-between"
          borderBottomWidth={1}
          borderBottomColor="$cloudMist"
        >
          <TouchableOpacity
            onPress={closePicker}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "#F5F5F5",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} color="$text" />
          </TouchableOpacity>
          <Text fontFamily="$heading" size="$7" fontWeight="700" color="$text">
            Select {title}
          </Text>
          <View width={40} />
        </Row>

        {/* Search Input */}
        {showSearch && (
          <Column paddingHorizontal="$4" paddingVertical="$3">
            <Row
              backgroundColor="$gray100"
              borderRadius="$xl"
              paddingHorizontal="$4"
              paddingVertical="$3"
              alignItems="center"
              gap="$3"
            >
              <Search size={20} color="$textSecondary" />
              <Input
                flex={1}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={`Search ${title.toLowerCase()}...`}
                placeholderTextColor="$textSecondary"
                borderWidth={0}
                backgroundColor="transparent"
                size="$6"
                color="$text"
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <X size={18} color="$textSecondary" />
                </TouchableOpacity>
              )}
            </Row>
          </Column>
        )}

        {/* Loading State */}
        {isLoading && (
          <Column padding="$6" alignItems="center" gap="$3">
            <Spinner size="sm" color="$spicedClementine" />
            <Text size="$4" color="$textSecondary">
              Loading...
            </Text>
          </Column>
        )}

        {/* Items List */}
        <ScrollView flex={1} keyboardShouldPersistTaps="handled">
          <Column paddingHorizontal="$4" paddingVertical="$2" gap="$2">
            {items.map((item, index) => {
              const isSelected = selectedId === item.id;
              return (
                <TouchableOpacity
                  key={`${item.id}-${index}`}
                  onPress={() => onSelect(item)}
                  accessibilityLabel={`Select ${item.name}`}
                >
                  <Row
                    paddingHorizontal="$4"
                    paddingVertical="$4"
                    alignItems="center"
                    borderRadius="$xl"
                    backgroundColor={isSelected ? "$lemonHaze" : "transparent"}
                    borderWidth={isSelected ? 2 : 0}
                    borderColor={isSelected ? "$spicedClementine" : "transparent"}
                  >
                    <Column flex={1} gap="$1">
                      <Text size="$6" fontWeight={isSelected ? "600" : "500"} color="$text">
                        {item.name}
                      </Text>
                    </Column>
                    {isSelected && (
                      <View
                        width={28}
                        height={28}
                        borderRadius="$full"
                        backgroundColor="$spicedClementine"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Check size={16} color="$pureWhite" />
                      </View>
                    )}
                  </Row>
                </TouchableOpacity>
              );
            })}

            {!isLoading && items.length === 0 && (
              <Column padding="$6" alignItems="center" gap="$2">
                <Text size="$5" fontWeight="500" color="$textSecondary">
                  {showSearch && searchQuery ? "No results found" : "Start typing to search"}
                </Text>
                {showSearch && !searchQuery && (
                  <Text size="$3" color="$textSecondary">
                    Enter at least 2 characters
                  </Text>
                )}
              </Column>
            )}
          </Column>
        </ScrollView>
      </Column>
    );
  };

  return (
    <Column
      flex={1}
      transition="quick"
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
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section */}
        <Column gap="$2" marginBottom="$6">
          <Text fontFamily="$heading" size="$10" fontWeight="800" color="$text">
            Item details
          </Text>
          <Text size="$5" fontWeight="400" color="$textSecondary">
            Help buyers find your item with accurate details
          </Text>
        </Column>

        {/* Form Fields */}
        <Column gap="$5">
          {/* Category */}
          {renderPickerButton(
            "Category",
            formData.categoryName,
            "What type of item is this?",
            "category"
          )}

          {/* Woods Subcategory - Conditional (Woods only) */}
          {shouldShowWoodsSubcategory() &&
            renderPickerButton(
              "Wood Type",
              formData.woodsSubcategory,
              "Driver, Fairway Wood, or Hybrid?",
              "woodsSubcategory",
              false,
              false
            )}

          {/* Brand */}
          {renderPickerButton("Brand", formData.brandName, "Who makes this item?", "brand")}

          {/* Model */}
          {renderPickerButton(
            "Model",
            formData.modelName,
            "Which model is it?",
            "model",
            !formData.brandId,
            false
          )}

          {/* Flex - Conditional (Woods & Irons) */}
          {shouldShowFlex() &&
            renderPickerButton(
              "Shaft Flex",
              FLEX_OPTIONS.find((f) => f.value === formData.flex)?.label ?? "",
              "Select shaft flex",
              "flex",
              false,
              false
            )}

          {/* Loft - Conditional (Woods & Wedges) */}
          {shouldShowLoft() &&
            renderPickerButton("Loft", formData.loft, "Select loft angle", "loft", false, false)}

          {/* Head Cover Included - Conditional (Woods & Putters) */}
          {shouldShowHeadCover() && (
            <Column gap="$2">
              <TouchableOpacity
                onPress={() => onUpdate({ headCoverIncluded: !formData.headCoverIncluded })}
                accessibilityLabel="Toggle head cover included"
              >
                <Row
                  backgroundColor="$pureWhite"
                  borderWidth={2}
                  borderColor={formData.headCoverIncluded ? "$spicedClementine" : "$cloudMist"}
                  borderRadius="$xl"
                  paddingHorizontal="$4"
                  paddingVertical="$4"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Text size="$6" fontWeight="500" color="$text">
                    Head cover included?
                  </Text>
                  <Switch
                    checked={formData.headCoverIncluded}
                    onCheckedChange={(checked) => onUpdate({ headCoverIncluded: !!checked })}
                  >
                    <Switch.Thumb transition="quick" />
                  </Switch>
                </Row>
              </TouchableOpacity>
            </Column>
          )}

          {/* Condition Rating Section - 3 Sliders */}
          <Column
            gap="$4"
            marginTop="$4"
            backgroundColor="$gray100"
            borderRadius="$xl"
            padding="$4"
          >
            <Column gap="$1">
              <Row alignItems="center" gap="$1">
                <Text fontFamily="$heading" size="$6" fontWeight="700" color="$text">
                  Condition Rating
                </Text>
                <Text size="$4" fontWeight="600" color="$error">
                  *
                </Text>
              </Row>
              <Text size="$4" fontWeight="400" color="$textSecondary">
                Rate each component from 1 (Poor) to 10 (Like New)
              </Text>
            </Column>

            {/* Grip Condition */}
            {renderConditionSlider("Grip", formData.gripCondition, (val) =>
              onUpdate({ gripCondition: val })
            )}

            {/* Head Condition */}
            {renderConditionSlider("Head", formData.headCondition, (val) =>
              onUpdate({ headCondition: val })
            )}

            {/* Shaft Condition */}
            {renderConditionSlider("Shaft", formData.shaftCondition, (val) =>
              onUpdate({ shaftCondition: val })
            )}
          </Column>
        </Column>

        {/* Helper Text */}
        <Column marginTop="$6" gap="$2">
          <Row backgroundColor="$lemonHaze" borderRadius="$lg" padding="$3" gap="$2">
            <Lightbulb size={14} color="$burntOlive" />
            <Text size="$3" color="$burntOlive">
              Accurate details help your item get discovered by the right buyers
            </Text>
          </Row>
        </Column>
      </ScrollView>

      {/* Picker Overlay */}
      {renderPickerContent()}
    </Column>
  );
}
