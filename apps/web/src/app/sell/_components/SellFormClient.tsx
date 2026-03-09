"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { LISTING_PRICE_LIMITS, getListingPriceBoundsMessage } from "@buttergolf/constants";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { useAutoSave, type AutoSaveStatus, type AutoSaveResult } from "@/hooks/useAutoSave";
import {
  Column,
  Row,
  Heading,
  Text,
  Button,
  Input,
  Card,
  Autocomplete,
  RadioGroup,
  Radio,
  RadioIndicator,
  Checkbox,
  Slider,
} from "@buttergolf/ui";
import { ImageUpload } from "@/components/ImageUpload";
import { PhotoTipsCard } from "./PhotoTipsCard";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
}

interface Model {
  id: string | null;
  name: string;
  source?: string;
  isVerified?: boolean;
  usageCount?: number;
}

interface FormData {
  title: string;
  description: string;
  price: string;
  brandId: string;
  brandName: string; // For display
  model: string;
  categoryId: string;
  flex: string; // Shaft flex for woods/irons
  loft: string; // Loft angle for woods/wedges
  woodsSubcategory: string; // Driver, Fairway Wood, Hybrid
  headCoverIncluded: boolean; // Head cover included for woods/putters
  gripCondition: number; // Grip condition rating 1-10
  headCondition: number; // Head condition rating 1-10
  shaftCondition: number; // Shaft condition rating 1-10
  images: string[];
}

const FLEX_OPTIONS = [
  { value: "", label: "Select flex (optional)" },
  { value: "L", label: "Ladies (L)" },
  { value: "A", label: "Senior (A)" },
  { value: "R", label: "Regular (R)" },
  { value: "S", label: "Stiff (S)" },
  { value: "X", label: "Extra Stiff (X)" },
];

const LOFT_OPTIONS_WOODS = [
  { value: "", label: "Select loft (optional)" },
  { value: "8°", label: "8°" },
  { value: "9°", label: "9°" },
  { value: "9.5°", label: "9.5°" },
  { value: "10°", label: "10°" },
  { value: "10.5°", label: "10.5°" },
  { value: "11°", label: "11°" },
  { value: "12°", label: "12°" },
  { value: "13°", label: "13°" },
  { value: "14°", label: "14°" },
  { value: "15°", label: "15°" },
  { value: "16°", label: "16°" },
  { value: "18°", label: "18°" },
  { value: "19°", label: "19°" },
  { value: "21°", label: "21°" },
  { value: "22°", label: "22°" },
  { value: "24°", label: "24°" },
  { value: "26°", label: "26°" },
];

const LOFT_OPTIONS_WEDGES = [
  { value: "", label: "Select loft (optional)" },
  { value: "46°", label: "46°" },
  { value: "48°", label: "48°" },
  { value: "50°", label: "50°" },
  { value: "52°", label: "52°" },
  { value: "54°", label: "54°" },
  { value: "56°", label: "56°" },
  { value: "58°", label: "58°" },
  { value: "60°", label: "60°" },
  { value: "62°", label: "62°" },
  { value: "64°", label: "64°" },
];

const WOODS_SUBCATEGORIES = [
  { value: "Driver", label: "Driver" },
  { value: "Fairway Wood", label: "Fairway Wood" },
  { value: "Hybrid", label: "Hybrid" },
];

const CONDITION_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Poor",
  3: "Fair",
  4: "Fair",
  5: "Good",
  6: "Good",
  7: "Good",
  8: "Excellent",
  9: "Excellent",
  10: "Like New",
};

// Label component for form fields
const FormLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <Row gap="$xs" marginBottom="$xs">
    <Text size="$3" weight="medium" color="$text">
      {children}
    </Text>
    {required && <Text color="$error">*</Text>}
  </Row>
);

// Helper text component
const HelperText = ({ children }: { children: React.ReactNode }) => (
  <Text size="$2" color="$helperText" marginTop="$xs">
    {children}
  </Text>
);

const SELL_DRAFT_STORAGE_KEY = "buttergolf-sell-draft-v1";

const EMPTY_FORM_DATA: FormData = {
  title: "",
  description: "",
  price: "",
  brandId: "",
  brandName: "",
  model: "",
  categoryId: "",
  flex: "",
  loft: "",
  woodsSubcategory: "",
  headCoverIncluded: false,
  gripCondition: 7,
  headCondition: 7,
  shaftCondition: 7,
  images: [],
};

function hasMeaningfulDraftContent(data: FormData): boolean {
  return (
    data.title.trim().length > 0 ||
    data.description.trim().length > 0 ||
    data.price.trim().length > 0 ||
    data.brandId.trim().length > 0 ||
    data.model.trim().length > 0 ||
    data.categoryId.trim().length > 0 ||
    data.flex.trim().length > 0 ||
    data.loft.trim().length > 0 ||
    data.woodsSubcategory.trim().length > 0 ||
    data.headCoverIncluded ||
    data.gripCondition !== 7 ||
    data.headCondition !== 7 ||
    data.shaftCondition !== 7 ||
    data.images.length > 0
  );
}

// Save status indicator
const SaveStatusIndicator = ({ status }: { status: AutoSaveStatus }) => {
  if (status === "idle") return null;

  const label =
    status === "saving"
      ? "Saving draft…"
      : status === "saved"
        ? "Draft saved"
        : "Failed to save draft";
  const colour = status === "error" ? "$error" : "$textSecondary";

  return (
    <Text size="$2" color={colour}>
      {label}
    </Text>
  );
};

interface SellFormClientProps {
  /** If provided, loads an existing draft from the database instead of starting fresh */
  draftId?: string;
}

export function SellFormClient({ draftId }: SellFormClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronous ref to prevent duplicate submissions (React state is async)
  const isSubmittingRef = useRef(false);
  // Request ID for server-side idempotency
  const requestIdRef = useRef<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [userAddedText, setUserAddedText] = useState<string>(""); // Track any manual additions
  const [isEditingTitle, setIsEditingTitle] = useState(false); // Track if user is manually editing

  // --- Persisted form state (localStorage) ---
  const [formData, setFormData, { isHydrated, clear: clearLocalDraft }] =
    useLocalStorageState<FormData>(SELL_DRAFT_STORAGE_KEY, EMPTY_FORM_DATA, { debounceMs: 1000 });

  // Track whether the user has dismissed the recovery prompt
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  // The draftId of the DB-saved draft (set after first autosave, or passed in as prop)
  const [savedDraftId, setSavedDraftId] = useState<string | null>(draftId ?? null);
  // Stable requestId for first-create idempotency until we get a real draft ID.
  const draftRequestIdRef = useRef<string>(uuidv4());

  // Show the recovery banner when localStorage has meaningful data and
  // we're NOT loading a specific draft from the DB
  const hasLocalDraft =
    isHydrated && !draftId && !recoveryDismissed && hasMeaningfulDraftContent(formData);

  // --- DB autosave via useAutoSave ---
  const persistDraft = useCallback(
    async (data: FormData): Promise<AutoSaveResult> => {
      if (!hasMeaningfulDraftContent(data)) {
        return "skipped";
      }

      const parsedPrice = Number.parseFloat(data.price);
      const safePrice = Number.isFinite(parsedPrice) ? parsedPrice : 0;

      try {
        if (savedDraftId) {
          const updatePayload: Record<string, unknown> = {
            title: data.title,
            description: data.description,
            price: safePrice,
            brandId: data.brandId || null,
            model: data.model || null,
            isDraft: true,
            flex: data.flex || null,
            loft: data.loft || null,
            woodsSubcategory: data.woodsSubcategory || null,
            headCoverIncluded: data.headCoverIncluded,
            gripCondition: data.gripCondition,
            headCondition: data.headCondition,
            shaftCondition: data.shaftCondition,
          };

          if (data.categoryId.trim().length > 0) {
            updatePayload.categoryId = data.categoryId;
          }

          // Update existing draft
          const response = await fetch(`/api/seller/products/${savedDraftId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatePayload),
          });
          return response.ok ? "saved" : "error";
        }

        // Create new draft
        const response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            price: safePrice,
            brandName: undefined,
            requestId: draftRequestIdRef.current,
            isDraft: true,
          }),
        });

        if (response.ok) {
          const product = await response.json();
          setSavedDraftId(product.id);
          return "saved";
        }
        return "error";
      } catch {
        return "error";
      }
    },
    [savedDraftId]
  );

  const handleAutoSave = useCallback(
    async (data: FormData): Promise<AutoSaveResult> => persistDraft(data),
    [persistDraft]
  );

  const { status: autoSaveStatus } = useAutoSave<FormData>({
    data: formData,
    onSave: handleAutoSave,
    debounceMs: 10_000,
    enabled: isHydrated && !loading,
  });

  // --- Load draft from DB when draftId prop is provided ---
  useEffect(() => {
    if (!draftId) return;

    const loadDraft = async () => {
      try {
        const response = await fetch(`/api/products/${draftId}`);
        if (!response.ok) return;

        const product = await response.json();

        const loaded: FormData = {
          title: product.title || "",
          description: product.description || "",
          price: product.price ? String(product.price) : "",
          brandId: product.brandId || "",
          brandName: product.brand?.name || "",
          model: product.model || "",
          categoryId: product.categoryId || "",
          flex: product.flex || "",
          loft: product.loft || "",
          woodsSubcategory: product.woodsSubcategory || "",
          headCoverIncluded: product.headCoverIncluded || false,
          gripCondition: product.gripCondition ?? 7,
          headCondition: product.headCondition ?? 7,
          shaftCondition: product.shaftCondition ?? 7,
          images: product.images?.map((img: { url: string }) => img.url) || [],
        };

        setFormData(loaded);
      } catch {
        // If load fails, start with whatever localStorage has
      }
    };

    void loadDraft();
  }, [draftId, setFormData]);

  // Helper function to singularize category names
  const singularize = (word: string): string => {
    // Handle common golf category plurals
    const pluralMap: Record<string, string> = {
      Woods: "Wood",
      Hybrids: "Hybrid",
      Irons: "Irons", // Keep as "Irons" in title
      Wedges: "Wedge",
      Putters: "Putter",
      Balls: "Ball",
      Bags: "Bag",
      Shoes: "Shoe",
      Gloves: "Glove",
      Accessories: "Accessory",
      Clubs: "Club",
      Sets: "Set",
    };

    // Check exact match first
    if (pluralMap[word]) {
      return pluralMap[word];
    }

    // Generic fallback: if ends with 's' and length > 2, remove the 's'
    if (word.endsWith("s") && word.length > 2) {
      return word.slice(0, -1);
    }

    return word;
  };

  // Helper function to generate title from form fields
  const generateTitle = useCallback((): string => {
    const parts: string[] = [];

    // Add brand name
    if (formData.brandName.trim()) {
      parts.push(formData.brandName.trim());
    }

    // Add model
    if (formData.model.trim()) {
      parts.push(formData.model.trim());
    }

    // Add category name (look up from categoryId and singularize)
    if (formData.categoryId) {
      const category = categories.find((c) => c.id === formData.categoryId);
      if (category) {
        parts.push(singularize(category.name));
      }
    }

    return parts.join(" ");
  }, [formData.brandName, formData.model, formData.categoryId, categories]);

  // Auto-generate title when relevant fields change
  useEffect(() => {
    const autoGeneratedTitle = generateTitle();

    // Always update with auto-generated title + any user additions
    const newTitle = userAddedText
      ? `${autoGeneratedTitle} ${userAddedText}`.trim()
      : autoGeneratedTitle;

    if (newTitle !== formData.title) {
      setFormData((prev) => ({ ...prev, title: newTitle }));
    }
  }, [
    formData.brandName,
    formData.model,
    formData.categoryId,
    userAddedText,
    categories,
    generateTitle,
    formData.title,
    setFormData,
  ]);

  // Load categories on mount
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch categories");
        }
        return res.json();
      })
      .then((data) => {
        // Ensure data is an array before setting
        if (Array.isArray(data)) {
          setCategories(data);
        } else {
          console.error("Invalid categories response:", data);
          setCategories([]);
        }
      })
      .catch((err) => {
        console.error("Failed to load categories:", err);
        setCategories([]);
      });
  }, []);

  // Helper functions to determine when to show conditional fields
  const shouldShowFlex = (): boolean => {
    if (!formData.categoryId) return false;
    const category = categories.find((c) => c.id === formData.categoryId);
    if (!category) return false;
    // Show flex for Woods and Irons
    return category.slug === "woods" || category.slug === "irons";
  };

  const shouldShowLoft = (): boolean => {
    if (!formData.categoryId) return false;
    const category = categories.find((c) => c.id === formData.categoryId);
    if (!category) return false;
    // Show loft for Woods and Wedges
    return category.slug === "woods" || category.slug === "wedges";
  };

  const getLoftOptions = () => {
    const category = categories.find((c) => c.id === formData.categoryId);
    if (!category) return [];
    // Return different loft options based on category
    return category.slug === "wedges" ? LOFT_OPTIONS_WEDGES : LOFT_OPTIONS_WOODS;
  };

  const shouldShowWoodsSubcategory = (): boolean => {
    if (!formData.categoryId) return false;
    const category = categories.find((c) => c.id === formData.categoryId);
    return category?.slug === "woods";
  };

  const shouldShowHeadCover = (): boolean => {
    if (!formData.categoryId) return false;
    const category = categories.find((c) => c.id === formData.categoryId);
    return category?.slug === "woods" || category?.slug === "putters";
  };

  const getConditionLabel = (value: number): string => {
    return CONDITION_LABELS[value] || "Good";
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Synchronous guard to prevent duplicate submissions
    // (React state updates are async, so we need a ref for immediate check)
    if (isSubmittingRef.current) {
      console.info("[SellForm] Duplicate submission blocked by ref guard");
      return;
    }
    isSubmittingRef.current = true;

    // Generate unique request ID for server-side idempotency
    requestIdRef.current = uuidv4();

    setLoading(true);
    setError(null);

    // Validate required fields
    if (
      !formData.title ||
      !formData.description ||
      !formData.price ||
      !formData.categoryId ||
      !formData.brandId
    ) {
      setError("Please fill in all required fields");
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    if (formData.images.length === 0) {
      setError("Please upload at least one image");
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    const parsedPrice = Number.parseFloat(formData.price);
    if (
      Number.isNaN(parsedPrice) ||
      parsedPrice < LISTING_PRICE_LIMITS.MIN ||
      parsedPrice > LISTING_PRICE_LIMITS.MAX
    ) {
      setError(getListingPriceBoundsMessage());
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          price: parsedPrice,
          // Don't send brandName (display only)
          brandName: undefined,
          // Request ID for server-side idempotency
          requestId: requestIdRef.current,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create listing");
      }

      const product = await response.json();
      clearLocalDraft();
      const successParams = new URLSearchParams({
        listed: "1",
        title: product.title || formData.title,
      });
      router.push(`/seller/listings?${successParams.toString()}`);
      // Note: Don't reset isSubmittingRef here - we're navigating away
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create listing");
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleSaveDraft = async () => {
    // Synchronous guard to prevent duplicate submissions
    if (isSubmittingRef.current) {
      console.info("[SellForm] Duplicate draft save blocked by ref guard");
      return;
    }
    isSubmittingRef.current = true;

    // Generate unique request ID for server-side idempotency
    requestIdRef.current = uuidv4();

    setLoading(true);
    setError(null);

    if (!hasMeaningfulDraftContent(formData)) {
      setError("Add at least one detail before saving a draft.");
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    try {
      const result = await persistDraft(formData);
      if (result !== "saved") {
        throw new Error("Failed to save draft");
      }

      // Navigate to seller listings page after saving draft
      clearLocalDraft();
      router.push("/seller/listings");
      // Note: Don't reset isSubmittingRef here - we're navigating away
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleImageUpload = (url: string) => {
    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, url],
    }));
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleReorderImages = (reorderedUrls: string[]) => {
    setFormData((prev) => ({
      ...prev,
      images: reorderedUrls,
    }));
  };

  return (
    <Column backgroundColor="$background" minHeight="100vh" alignItems="center" width="100%">
      <Column
        maxWidth={1100}
        paddingHorizontal="$8"
        width="100%"
        alignSelf="center"
        marginHorizontal="auto"
      >
        <Column gap="$xl" paddingVertical="$10" width="100%" alignItems="stretch">
          {/* Header */}
          <Column gap="$sm" alignItems="center">
            <Row gap="$md" alignItems="center">
              <Heading level={2}>Sell an item</Heading>
              <SaveStatusIndicator status={autoSaveStatus} />
            </Row>
          </Column>

          {/* Draft recovery banner */}
          {hasLocalDraft && (
            <Card variant="outlined" padding="$md" backgroundColor="$primaryLight">
              <Row gap="$md" alignItems="center" justifyContent="space-between" flexWrap="wrap">
                <Text size="$5" color="$text">
                  You have an unsaved draft. Would you like to continue where you left off?
                </Text>
                <Row gap="$sm">
                  <Button
                    size="$3"
                    chromeless
                    onPress={() => {
                      clearLocalDraft();
                      setFormData(EMPTY_FORM_DATA);
                      setRecoveryDismissed(true);
                    }}
                  >
                    <Text size="$4" color="$textSecondary">
                      Discard
                    </Text>
                  </Button>
                  <Button
                    butterVariant="primary"
                    size="$3"
                    onPress={() => setRecoveryDismissed(true)}
                  >
                    <Text size="$4" color="$textInverse">
                      Continue
                    </Text>
                  </Button>
                </Row>
              </Row>
            </Card>
          )}

          {/* Main Form Card */}
          <Card
            variant="elevated"
            padding="$0"
            backgroundColor="$surface"
            borderRadius="$lg"
            overflow="hidden"
            width="100%"
          >
            <form onSubmit={handleSubmit} style={{ width: "100%" }}>
              <Column gap="$0" width="100%" alignItems="stretch">
                {/* Photo Upload Section - Prominent at top */}
                <Column
                  gap="$lg"
                  padding="$6"
                  backgroundColor="$background"
                  borderBottomWidth={1}
                  borderBottomColor="$border"
                  width="100%"
                >
                  <Row gap="$lg" flexWrap="wrap" $gtMd={{ flexWrap: "nowrap" }} width="100%">
                    {/* Left: Image Upload (2/3 width on desktop) */}
                    <Column flex={2} minWidth={300} width="100%">
                      <ImageUpload
                        onUploadComplete={handleImageUpload}
                        onRemoveImage={handleRemoveImage}
                        onReorderImages={handleReorderImages}
                        currentImages={formData.images}
                        maxImages={5}
                      />
                    </Column>

                    {/* Right: Photo Tips Card (1/3 width on desktop) */}
                    <Column flex={1} minWidth={280} width="100%">
                      <PhotoTipsCard />
                    </Column>
                  </Row>
                </Column>

                {/* Form Fields Section */}
                <Column gap="$md" padding="$6" width="100%">
                  {/* Title */}
                  <Column gap="$xs" width="100%">
                    <FormLabel required>Title</FormLabel>
                    {isEditingTitle ? (
                      <Column gap="$xs" width="100%">
                        <Input
                          value={formData.title}
                          onChangeText={(value) => {
                            const autoGenerated = generateTitle();
                            // Extract any text the user added beyond the auto-generated part
                            if (value.startsWith(autoGenerated)) {
                              const userText = value.substring(autoGenerated.length).trim();
                              setUserAddedText(userText);
                            } else {
                              // If user changed the auto-generated part, store the whole thing
                              setFormData({ ...formData, title: value });
                            }
                          }}
                          placeholder="e.g. Titleist a 2023 Driver"
                          size="$4"
                          width="100%"
                          required
                        />
                        <Text size="$2" color="$textSecondary">
                          Title auto-updates as you fill in brand, model, category, and condition
                        </Text>
                      </Column>
                    ) : (
                      <Column gap="$xs" width="100%">
                        <Row
                          gap="$sm"
                          alignItems="center"
                          padding="$3"
                          backgroundColor="$backgroundHover"
                          borderRadius="$full"
                          borderWidth={1}
                          borderColor="$border"
                          width="100%"
                        >
                          <Text flex={1} size="$5" color={formData.title ? "$text" : "$textMuted"}>
                            {formData.title || "Auto-generated from fields below"}
                          </Text>
                          <Button size="$3" onPress={() => setIsEditingTitle(true)}>
                            Edit
                          </Button>
                        </Row>
                        <Text size="$2" color="$textSecondary">
                          Auto-generated - Click Edit to add custom text
                        </Text>
                      </Column>
                    )}
                  </Column>

                  {/* Category */}
                  <Column gap="$xs" width="100%">
                    <FormLabel required>Category</FormLabel>
                    {/* eslint-disable-next-line react/forbid-elements -- TODO: replace with design-system Select */}
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      required
                      style={{
                        padding: "12px 18px",
                        fontSize: "15px",
                        borderRadius: "24px",
                        border: "1px solid #323232",
                        backgroundColor: "white",
                        width: "100%",
                        cursor: "pointer",
                        outline: "none",
                        appearance: "none",
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23F45314' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                        backgroundPosition: "right 18px center",
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "20px",
                        paddingRight: "48px",
                        transition: "border-color 0.2s",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#F45314";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#323232";
                      }}
                    >
                      <option value="">Select a category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </Column>

                  {/* Woods Sub-category - Conditional (Woods only) */}
                  {shouldShowWoodsSubcategory() && (
                    <Column gap="$xs" width="100%">
                      <FormLabel>Type</FormLabel>
                      <RadioGroup
                        value={formData.woodsSubcategory}
                        onValueChange={(value) =>
                          setFormData({ ...formData, woodsSubcategory: value })
                        }
                        orientation="horizontal"
                      >
                        {WOODS_SUBCATEGORIES.map((sub) => (
                          <Row key={sub.value} gap="$xs" alignItems="center">
                            <Radio value={sub.value}>
                              <RadioIndicator />
                            </Radio>
                            <Text
                              size="$4"
                              color="$text"
                              onPress={() =>
                                setFormData({
                                  ...formData,
                                  woodsSubcategory: sub.value,
                                })
                              }
                              cursor="pointer"
                            >
                              {sub.label}
                            </Text>
                          </Row>
                        ))}
                      </RadioGroup>
                      <HelperText>Select the type of wood</HelperText>
                    </Column>
                  )}

                  {/* Brand & Model Row */}
                  <Row gap="$md" flexWrap="wrap">
                    <Column gap="$xs" flex={1} minWidth={200}>
                      <FormLabel required>Brand</FormLabel>
                      <Autocomplete
                        value={formData.brandName}
                        onValueChange={(value) => setFormData({ ...formData, brandName: value })}
                        onSelectSuggestion={(suggestion) => {
                          setFormData({
                            ...formData,
                            brandId: suggestion.id || "",
                            brandName: suggestion.name,
                            // Clear model when brand changes
                            model: "",
                          });
                          // Reset manual editing when brand changes
                          setUserAddedText("");
                          setIsEditingTitle(false);
                        }}
                        fetchSuggestions={async (query) => {
                          const res = await fetch(`/api/brands?query=${encodeURIComponent(query)}`);
                          const brands: Brand[] = await res.json();
                          return brands.map((b) => ({
                            id: b.id,
                            name: b.name,
                            metadata: { slug: b.slug, logoUrl: b.logoUrl },
                          }));
                        }}
                        placeholder="Select or search brands"
                        size="$4"
                        width="100%"
                        minChars={0}
                        allowCustom={false}
                      />
                      <HelperText>Click to see all brands or start typing to search</HelperText>
                    </Column>

                    <Column gap="$xs" flex={1} minWidth={200}>
                      <FormLabel>Model</FormLabel>
                      <Autocomplete
                        value={formData.model}
                        onValueChange={(value) => setFormData({ ...formData, model: value })}
                        onSelectSuggestion={(suggestion) => {
                          setFormData({
                            ...formData,
                            model: suggestion.name,
                          });
                        }}
                        fetchSuggestions={async (query) => {
                          if (!formData.brandId) return [];
                          const res = await fetch(
                            `/api/models?brandId=${formData.brandId}&query=${encodeURIComponent(query)}`
                          );
                          const models: Model[] = await res.json();
                          return models.map((m) => ({
                            id: m.id,
                            name: m.name,
                            metadata: {
                              isVerified: m.isVerified,
                              usageCount: m.usageCount,
                            },
                          }));
                        }}
                        placeholder={
                          formData.brandId ? "Select or search models" : "Select a brand first"
                        }
                        size="$4"
                        width="100%"
                        minChars={0}
                        allowCustom={true}
                        disabled={!formData.brandId}
                      />
                      <HelperText>Click to see models or type your own</HelperText>
                    </Column>
                  </Row>

                  {/* Head Cover Included - Conditional (Woods & Putters) */}
                  {shouldShowHeadCover() && (
                    <Column gap="$xs" width="100%">
                      <Row gap="$sm" alignItems="center">
                        <Checkbox
                          checked={formData.headCoverIncluded}
                          onChange={(checked) =>
                            setFormData({
                              ...formData,
                              headCoverIncluded: checked,
                            })
                          }
                          size="md"
                        />
                        <Text
                          size="$4"
                          color="$text"
                          onPress={() =>
                            setFormData({
                              ...formData,
                              headCoverIncluded: !formData.headCoverIncluded,
                            })
                          }
                          cursor="pointer"
                        >
                          Head cover included?
                        </Text>
                      </Row>
                    </Column>
                  )}

                  {/* Condition Sliders - Always Visible (Replaces Dropdown) */}
                  <Column gap="$lg" width="100%">
                    <FormLabel required>Condition Rating</FormLabel>
                    <Text size="$3" color="$textSecondary" marginBottom="$sm">
                      Rate each component from 1 (Poor) to 10 (Like New)
                    </Text>

                    {/* Grip Condition */}
                    <Column gap="$xs" width="100%">
                      <Row justifyContent="space-between" alignItems="center">
                        <Text size="$4" weight="medium" color="$text">
                          Grip
                        </Text>
                        <Text size="$4" color="$primary" weight="semibold">
                          {formData.gripCondition} - {getConditionLabel(formData.gripCondition)}
                        </Text>
                      </Row>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[formData.gripCondition]}
                        onValueChange={(values) =>
                          setFormData({ ...formData, gripCondition: values[0] })
                        }
                      >
                        <Slider.Track>
                          <Slider.TrackActive />
                        </Slider.Track>
                        <Slider.Thumb index={0} />
                      </Slider>
                    </Column>

                    {/* Head Condition */}
                    <Column gap="$xs" width="100%">
                      <Row justifyContent="space-between" alignItems="center">
                        <Text size="$4" weight="medium" color="$text">
                          Head
                        </Text>
                        <Text size="$4" color="$primary" weight="semibold">
                          {formData.headCondition} - {getConditionLabel(formData.headCondition)}
                        </Text>
                      </Row>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[formData.headCondition]}
                        onValueChange={(values) =>
                          setFormData({ ...formData, headCondition: values[0] })
                        }
                      >
                        <Slider.Track>
                          <Slider.TrackActive />
                        </Slider.Track>
                        <Slider.Thumb index={0} />
                      </Slider>
                    </Column>

                    {/* Shaft Condition */}
                    <Column gap="$xs" width="100%">
                      <Row justifyContent="space-between" alignItems="center">
                        <Text size="$4" weight="medium" color="$text">
                          Shaft
                        </Text>
                        <Text size="$4" color="$primary" weight="semibold">
                          {formData.shaftCondition} - {getConditionLabel(formData.shaftCondition)}
                        </Text>
                      </Row>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[formData.shaftCondition]}
                        onValueChange={(values) =>
                          setFormData({
                            ...formData,
                            shaftCondition: values[0],
                          })
                        }
                      >
                        <Slider.Track>
                          <Slider.TrackActive />
                        </Slider.Track>
                        <Slider.Thumb index={0} />
                      </Slider>
                    </Column>
                  </Column>

                  {/* Description */}
                  <Column gap="$xs" width="100%">
                    <FormLabel required>Describe your item</FormLabel>
                    {/* eslint-disable-next-line react/forbid-elements -- TODO: replace with design-system TextArea */}
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="e.g. only used for one season, minor scratches on the shaft..."
                      required
                      rows={3}
                      style={{
                        padding: "12px 18px",
                        fontSize: "15px",
                        lineHeight: "22px",
                        borderRadius: "24px",
                        border: "1px solid #323232",
                        backgroundColor: "white",
                        width: "100%",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                        resize: "none",
                        outline: "none",
                        transition: "border-color 0.2s",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "#F45314";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#323232";
                      }}
                    />
                    <HelperText>
                      Be honest and detailed. Mention any wear, included accessories, and why
                      you&apos;re selling.
                    </HelperText>
                  </Column>

                  {/* Flex - Conditional (Woods & Irons) */}
                  {shouldShowFlex() && (
                    <Column gap="$xs" width="100%">
                      <FormLabel>Shaft Flex</FormLabel>
                      {/* eslint-disable-next-line react/forbid-elements -- TODO: replace with design-system Select */}
                      <select
                        value={formData.flex}
                        onChange={(e) => setFormData({ ...formData, flex: e.target.value })}
                        style={{
                          padding: "12px 18px",
                          fontSize: "15px",
                          borderRadius: "24px",
                          border: "1px solid #323232",
                          backgroundColor: "white",
                          width: "100%",
                          cursor: "pointer",
                          outline: "none",
                          appearance: "none",
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23F45314' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                          backgroundPosition: "right 18px center",
                          backgroundRepeat: "no-repeat",
                          backgroundSize: "20px",
                          paddingRight: "48px",
                          transition: "border-color 0.2s",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#F45314";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "#323232";
                        }}
                      >
                        {FLEX_OPTIONS.map((flex) => (
                          <option key={flex.value} value={flex.value}>
                            {flex.label}
                          </option>
                        ))}
                      </select>
                      <HelperText>Select the shaft flex rating</HelperText>
                    </Column>
                  )}

                  {/* Loft - Conditional (Woods & Wedges) */}
                  {shouldShowLoft() && (
                    <Column gap="$xs" width="100%">
                      <FormLabel>Loft</FormLabel>
                      {/* eslint-disable-next-line react/forbid-elements -- TODO: replace with design-system Select */}
                      <select
                        value={formData.loft}
                        onChange={(e) => setFormData({ ...formData, loft: e.target.value })}
                        style={{
                          padding: "12px 18px",
                          fontSize: "15px",
                          borderRadius: "24px",
                          border: "1px solid #323232",
                          backgroundColor: "white",
                          width: "100%",
                          cursor: "pointer",
                          outline: "none",
                          appearance: "none",
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23F45314' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                          backgroundPosition: "right 18px center",
                          backgroundRepeat: "no-repeat",
                          backgroundSize: "20px",
                          paddingRight: "48px",
                          transition: "border-color 0.2s",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#F45314";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "#323232";
                        }}
                      >
                        {getLoftOptions().map((loft) => (
                          <option key={loft.value} value={loft.value}>
                            {loft.label}
                          </option>
                        ))}
                      </select>
                      <HelperText>Select the loft angle</HelperText>
                    </Column>
                  )}

                  {/* Price */}
                  <Column gap="$xs" width="100%">
                    <FormLabel required>Price</FormLabel>
                    <Row gap="$sm" alignItems="center">
                      <Text size="$6" weight="semibold">
                        £
                      </Text>
                      <Input
                        value={formData.price}
                        onChangeText={(value) => setFormData({ ...formData, price: value })}
                        placeholder="0.00"
                        size="$4"
                        width="100%"
                        required
                        inputMode="decimal"
                        min={LISTING_PRICE_LIMITS.MIN}
                        max={LISTING_PRICE_LIMITS.MAX}
                      />
                    </Row>
                    <HelperText>
                      Enter your asking price in GBP ({LISTING_PRICE_LIMITS.MIN} -{" "}
                      {LISTING_PRICE_LIMITS.MAX})
                    </HelperText>
                  </Column>

                  {/* Error Message */}
                  {error && (
                    <Card
                      variant="filled"
                      padding="$md"
                      backgroundColor="$errorLight"
                      borderRadius="$md"
                    >
                      <Text color="$error">{error}</Text>
                    </Card>
                  )}
                </Column>

                {/* Action Buttons - Sticky footer style */}
                <Column
                  gap="$sm"
                  padding="$5"
                  backgroundColor="$background"
                  borderTopWidth={1}
                  borderTopColor="$border"
                  width="100%"
                >
                  <Row gap="$sm" justifyContent="space-between" width="100%">
                    <Button size="$5" onPress={handleSaveDraft} disabled={loading} flex={1}>
                      {loading ? "Saving..." : "Save draft"}
                    </Button>
                    {/* Use type="submit" for native form submission only - no onPress to prevent dual submission */}
                    <Button size="$5" disabled={loading} type="submit" flex={1}>
                      {loading ? "Publishing..." : "List item"}
                    </Button>
                  </Row>
                  <Text size="$2" color="$helperText" textAlign="center">
                    What do you think of our upload process?{" "}
                    <Text size="$2" color="$primary" cursor="pointer">
                      Give feedback
                    </Text>
                  </Text>
                </Column>
              </Column>
            </form>
          </Card>
        </Column>
      </Column>
    </Column>
  );
}
