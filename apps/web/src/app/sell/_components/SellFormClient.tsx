"use client";

import { useState, useEffect, useCallback, useRef, useReducer } from "react";
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
  Spinner,
} from "@buttergolf/ui";
import { ImageUpload } from "@/components/ImageUpload";
import { PhotoTipsCard } from "./PhotoTipsCard";
import {
  sellRecordReducer,
  initialSellRecordState,
  canSave,
  saveTarget,
  isHydrating,
  hasLoadFailed,
  canApplyWrite,
  canApplyLoad,
  matchesRoute,
  type SellRecordEvent,
} from "../_lib/sell-record-state";
import { createSaveQueue, type SaveQueue } from "../_lib/save-queue";
import { fetchJsonWithTimeout } from "../_lib/fetch-with-timeout";

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
    <Text size="$3" fontWeight="500" color="$text">
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

/** Shown when a save is attempted before the record being edited has loaded. */
const RECORD_NOT_READY_MESSAGE =
  "Still loading this listing. Give it a moment and try again — or reload the page if this persists.";

/** Shown when the page moved to a different listing mid-save. */
const RECORD_CHANGED_MESSAGE =
  "You moved to a different listing before this finished saving, so nothing was written. Go back and try again.";

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
const SaveStatusIndicator = ({
  status,
  isEditingListing,
}: {
  status: AutoSaveStatus;
  isEditingListing: boolean;
}) => {
  if (status === "idle") return null;

  // A live listing being edited is never a draft, so don't call it one.
  const noun = isEditingListing ? "changes" : "draft";
  const label =
    status === "saving"
      ? `Saving ${noun}…`
      : status === "saved"
        ? isEditingListing
          ? "Changes saved"
          : "Draft saved"
        : `Failed to save ${noun}`;
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
  /**
   * If provided, edits an already-published listing. The form keeps the listing
   * live throughout — autosave never flips it back to a draft — and the primary
   * action saves changes rather than publishing.
   */
  editProductId?: string;
}

export function SellFormClient({ draftId, editProductId }: SellFormClientProps) {
  const isEditingListing = Boolean(editProductId);
  // Both modes load an existing product by id; they differ in how it's saved.
  const loadProductId = editProductId ?? draftId;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronous ref to prevent duplicate submissions (React state is async)
  const isSubmittingRef = useRef(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [userAddedText, setUserAddedText] = useState<string>(""); // Track any manual additions
  const [isEditingTitle, setIsEditingTitle] = useState(false); // Track if user is manually editing
  // When the user fully replaces the auto-generated title, stop overwriting it
  const titleManuallyOverriddenRef = useRef(false);

  // --- Persisted form state (localStorage) ---
  // One key per record. Sharing a key across records is not just untidy: the
  // hook syncs across tabs, so two tabs resuming *different* drafts would push
  // each other's fields into one another and then autosave them to the wrong
  // row. The generation machinery can't catch that — from each tab's point of
  // view the record never changed — so the keys have to be distinct.
  //
  // The bare key stays reserved for a brand-new listing, which is what the
  // recovery banner offers to restore.
  const storageKey = editProductId
    ? `${SELL_DRAFT_STORAGE_KEY}-edit-${editProductId}`
    : draftId
      ? `${SELL_DRAFT_STORAGE_KEY}-draft-${draftId}`
      : SELL_DRAFT_STORAGE_KEY;

  const [formData, setFormData, { isHydrated, clear: clearLocalDraft }] =
    useLocalStorageState<FormData>(storageKey, EMPTY_FORM_DATA, { debounceMs: 1000 });

  // Track whether the user has dismissed the recovery prompt
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  // --- Record identity ---
  // Which row this form writes to, whether the data on screen is actually that
  // row's, and which in-flight work is still relevant. All of it lives in one
  // reducer (see _lib/sell-record-state.ts) so the rules are in one place and
  // unit-testable, rather than spread across half a dozen refs that have to
  // agree at every await.
  const [record, dispatchRecord] = useReducer(sellRecordReducer, undefined, () =>
    initialSellRecordState(loadProductId ?? null, uuidv4())
  );
  // A synchronous mirror of the same reducer, for code that can't wait for a
  // render. Serialising writes is not enough on its own: `dispatchRecord`
  // schedules the reducer, so a publish queued behind an autosave that just
  // created a row would still read `rowId === null` and POST a *second*
  // product, leaving an orphaned draft beside the live listing. Every event
  // goes through applyRecordEvent, so the ref and the state stay derived from
  // one rule and cannot diverge.
  const recordRef = useRef(record);
  // The route as of this render. Async guards compare against it so a prop
  // change closes the write window immediately, without waiting for the
  // passive route-change effect.
  // The generation whose data is currently in `formData`. Tracked where the
  // form is assigned rather than read when a save fires, so a debounced payload
  // can never be attributed to a record it did not come from.
  const formDataGenerationRef = useRef(0);
  const routeIdRef = useRef<string | null>(loadProductId ?? null);
  routeIdRef.current = loadProductId ?? null;

  const applyRecordEvent = useCallback((event: SellRecordEvent) => {
    recordRef.current = sellRecordReducer(recordRef.current, event);
    dispatchRecord(event);
  }, []);

  // Readiness also compares the route: `loadProductId` changes during render
  // while the route-change effect is passive and runs later, so checking the
  // record alone leaves a window where the previous listing still looks
  // saveable under the new URL.
  const isRecordReadyToSave = canSave(record) && record.routeId === (loadProductId ?? null);
  // A route mismatch counts as loading. Otherwise, for the render between the
  // route changing and the passive effect, the previous listing stays editable
  // and anything typed is silently discarded when the new record lands.
  const isLoadingRecord = isHydrating(record) || !matchesRoute(record, loadProductId ?? null);
  const recordLoadFailed = hasLoadFailed(record);

  // --- Write ordering ---
  // Autosave, "Save draft" and publish all mutate the same row, so they run
  // through one FIFO queue. At most one write is in flight at a time and they
  // land in the order requested, which is what stops an autosave overwriting a
  // publish with `isDraft: true`.
  const saveQueueRef = useRef<SaveQueue | null>(null);
  saveQueueRef.current ??= createSaveQueue();

  // Show the recovery banner when localStorage has meaningful data and
  // we're NOT loading a specific draft from the DB
  const hasLocalDraft =
    isHydrated && !loadProductId && !recoveryDismissed && hasMeaningfulDraftContent(formData);

  // --- DB autosave via useAutoSave ---
  const persistDraft = useCallback(
    async (data: FormData, dataGeneration: number): Promise<AutoSaveResult> => {
      if (!hasMeaningfulDraftContent(data)) {
        return "skipped";
      }

      const parsedPrice = Number.parseFloat(data.price);
      const safePrice = Number.isFinite(parsedPrice) ? parsedPrice : 0;

      // Read the record at the moment this write actually starts, and require
      // it to be the same one `data` was captured from. Reading only the
      // current target would let a queued autosave for A write A.s fields into
      // B once B had loaded.
      const snapshot = recordRef.current;
      if (!matchesRoute(snapshot, routeIdRef.current) || !canApplyWrite(snapshot, dataGeneration)) {
        return "skipped";
      }

      const generation = snapshot.generation;
      const existingId = saveTarget(snapshot);

      try {
        if (existingId) {
          const updatePayload: Record<string, unknown> = {
            title: data.title,
            description: data.description,
            price: safePrice,
            brandId: data.brandId || null,
            model: data.model || null,
            // Only new listings autosave as drafts. Editing a live listing must
            // never unpublish it part-way through the seller's changes.
            ...(isEditingListing ? {} : { isDraft: true }),
            flex: data.flex || null,
            loft: data.loft || null,
            woodsSubcategory: data.woodsSubcategory || null,
            headCoverIncluded: data.headCoverIncluded,
            gripCondition: data.gripCondition,
            headCondition: data.headCondition,
            shaftCondition: data.shaftCondition,
            // Drafts carry their photos too, so the seller hub can render a
            // thumbnail instead of a broken image.
            images: data.images.map((url, index) => ({ url, sortOrder: index })),
          };

          if (data.categoryId.trim().length > 0) {
            updatePayload.categoryId = data.categoryId;
          }

          // Update existing draft
          const response = await fetchJsonWithTimeout(`/api/seller/products/${existingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatePayload),
          });
          return response.ok ? "saved" : "error";
        }

        // Create new draft
        const response = await fetchJsonWithTimeout("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            price: safePrice,
            brandName: undefined,
            requestId: snapshot.createRequestId,
            isDraft: true,
          }),
        });

        if (response.ok) {
          const product = response.data as { id?: string } | undefined;
          if (!product?.id) return "error";
          // Stamped with the generation this write started in; the reducer
          // discards it if the form has since moved to another record.
          applyRecordEvent({ type: "row-created", generation, rowId: product.id });
          return "saved";
        }
        return "error";
      } catch {
        return "error";
      }
    },
    [isEditingListing, applyRecordEvent]
  );

  const handleAutoSave = useCallback(
    async (data: FormData): Promise<AutoSaveResult> => {
      // Queued like every other write, so it can never overtake or be overtaken
      // by a publish. persistDraft re-checks the record when it actually runs.
      if (isSubmittingRef.current) {
        return "skipped";
      }
      const dataGeneration = formDataGenerationRef.current;
      return saveQueueRef.current!.enqueue(() => persistDraft(data, dataGeneration));
    },
    [persistDraft]
  );

  const { status: autoSaveStatus } = useAutoSave<FormData>({
    data: formData,
    onSave: handleAutoSave,
    debounceMs: 10_000,
    // When we're loading an existing draft or listing, autosave must wait until
    // that load has landed. Saving the blank initial form over the top would
    // otherwise wipe the record's photos and fields.
    enabled: isHydrated && !loading && isRecordReadyToSave,
  });

  // --- Record switching ---
  // One dispatch resets everything record-scoped: the write target, the load
  // phase, the idempotency key, and the generation that invalidates work
  // already in flight for the record being left.
  useEffect(() => {
    const currentRouteId = loadProductId ?? null;

    // Idempotent by comparing against the record itself rather than a
    // "have I run before?" flag. Strict Mode mounts effects twice in
    // development, and a flag would read the second mount as a record switch —
    // wiping a recovered local draft on /sell, or discarding the first load and
    // bumping the generation for a routed record.
    if (recordRef.current.routeId === currentRouteId) return;

    applyRecordEvent({
      type: "route-changed",
      routeId: currentRouteId,
      createRequestId: uuidv4(),
    });

    // Title provenance and the seller's manual additions belong to the record
    // that was on screen, not the one arriving.
    titleManuallyOverriddenRef.current = false;
    setUserAddedText("");

    if (!currentRouteId) {
      // The form is now the blank one for the generation just created
      // (applyRecordEvent updates the ref synchronously). Clearing the fields
      // themselves is useLocalStorageState's job: the key changed, so it either
      // hydrates whatever the new key holds or resets to the default.
      formDataGenerationRef.current = recordRef.current.generation;
    }
    // For a routed record the form still holds the *previous* record's data
    // until the load lands, so formDataGenerationRef deliberately stays behind —
    // any autosave of it is skipped rather than written to the new row.
  }, [loadProductId, applyRecordEvent]);

  // --- Loading the routed record ---
  // Driven by the state machine rather than by the route directly: it runs
  // whenever a record enters the "loading" phase, and stamps its result with
  // the generation it read from state. The reducer drops results whose
  // generation has moved on, so there is exactly one staleness rule.
  const { phase: recordPhase, routeId: recordRouteId, generation: recordGeneration } = record;

  useEffect(() => {
    if (recordPhase !== "loading" || !recordRouteId) return;

    let applied = false;

    const loadRecord = async () => {
      try {
        const response = await fetch(`/api/products/${recordRouteId}`);
        if (!response.ok) {
          applyRecordEvent({ type: "load-failed", generation: recordGeneration });
          return;
        }

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

        // The reducer would reject the event below, but `formData` lives
        // outside it — so without this check an out-of-order response could
        // still push its data onto the screen, leaving the form showing one
        // record while targeting another.
        if (!canApplyLoad(recordRef.current, recordGeneration)) return;

        // A stored title is the seller's, whether they typed it or accepted the
        // generated one. Without this the auto-title effect would regenerate
        // from brand/model/category as soon as categories load and quietly
        // replace a custom title — which "Save changes" would then persist.
        if (loaded.title.trim().length > 0) {
          titleManuallyOverriddenRef.current = true;
        }

        applied = true;
        setFormData(loaded);
        formDataGenerationRef.current = recordGeneration;
        applyRecordEvent({ type: "load-succeeded", generation: recordGeneration });
      } catch {
        // Surface the failure rather than leaving a spinner up forever. Saving
        // stays blocked either way, so a failed fetch can never overwrite the
        // record with a blank form.
        if (!applied) {
          applyRecordEvent({ type: "load-failed", generation: recordGeneration });
        }
      }
    };

    void loadRecord();
  }, [recordPhase, recordRouteId, recordGeneration, setFormData, applyRecordEvent]);

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

    // Add the club type. For Woods the chosen sub-type (Driver / Fairway Wood /
    // Hybrid) is what a buyer actually searches for, so it replaces the generic
    // parent category — "TaylorMade Qi10 Driver", not "TaylorMade Qi10 Wood".
    if (formData.categoryId) {
      const category = categories.find((c) => c.id === formData.categoryId);
      if (category) {
        const subcategory = formData.woodsSubcategory.trim();
        const useSubcategory = category.slug === "woods" && subcategory.length > 0;
        parts.push(useSubcategory ? subcategory : singularize(category.name));
      }
    }

    return parts.join(" ");
  }, [
    formData.brandName,
    formData.model,
    formData.categoryId,
    formData.woodsSubcategory,
    categories,
  ]);

  // Auto-generate title when relevant fields change
  useEffect(() => {
    // Respect the user's manual title override
    if (titleManuallyOverriddenRef.current) return;

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

  /**
   * Switching category clears the fields that only apply to the category being
   * left, so a putter can't keep "Driver" as its type (which would then leak
   * into the auto-generated title).
   */
  const handleCategoryChange = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);

    setFormData({
      ...formData,
      categoryId,
      ...(category?.slug === "woods" ? {} : { woodsSubcategory: "" }),
      ...(category?.slug === "woods" || category?.slug === "putters"
        ? {}
        : { headCoverIncluded: false }),
    });
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

    // Refuse to write while the record being edited is still loading (or failed
    // to load): the form is showing either a blank form or the previous
    // listing's data, so there is no correct target for this save.
    if (!isRecordReadyToSave) {
      setError(RECORD_NOT_READY_MESSAGE);
      return;
    }

    isSubmittingRef.current = true;

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

    // The record this submit is for. Queued behind any autosave already
    // running, so by the time it executes an in-flight draft creation has
    // finished and its row id is in the state machine.
    const capturedGeneration = record.generation;

    try {
      const response = await saveQueueRef.current!.enqueue(async () => {
        // Re-read once this write actually starts. If the form moved to a
        // different record while queued, this data belongs nowhere — writing it
        // would publish the wrong listing or duplicate it.
        const snapshot = recordRef.current;
        if (
          !matchesRoute(snapshot, routeIdRef.current) ||
          !canApplyWrite(snapshot, capturedGeneration)
        ) {
          return null;
        }

        // Autosave may already have created a draft row for this listing.
        // Publish THAT row rather than POSTing a second product — otherwise the
        // draft is orphaned and sits in the seller's listings as an untitled
        // £0.00 card.
        const draftToPublish = saveTarget(snapshot);

        return draftToPublish
          ? await fetchJsonWithTimeout(`/api/seller/products/${draftToPublish}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                title: formData.title,
                description: formData.description,
                price: parsedPrice,
                // `condition` is derived server-side from the three sliders below.
                brandId: formData.brandId,
                model: formData.model || null,
                categoryId: formData.categoryId,
                flex: formData.flex || null,
                loft: formData.loft || null,
                woodsSubcategory: formData.woodsSubcategory || null,
                headCoverIncluded: formData.headCoverIncluded,
                gripCondition: formData.gripCondition,
                headCondition: formData.headCondition,
                shaftCondition: formData.shaftCondition,
                images: formData.images.map((url, index) => ({ url, sortOrder: index })),
                // Editing a live listing leaves isDraft alone; publishing a draft
                // flips it.
                ...(isEditingListing ? {} : { isDraft: false }),
              }),
            })
          : await fetchJsonWithTimeout("/api/products", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ...formData,
                price: parsedPrice,
                // Don't send brandName (display only)
                brandName: undefined,
                // The record.s stable create key, not a fresh one: if the
                // autosave POST committed but its response was lost, rowId is
                // still null and we land here. Reusing the key makes the
                // server return that same draft instead of creating a second
                // product beside it.
                requestId: snapshot.createRequestId,
              }),
            });
      });

      // The queued write found the form on a different record and stood down.
      if (response === null) {
        setError(RECORD_CHANGED_MESSAGE);
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      if (!response.ok) {
        const errorData = response.data as { error?: string } | undefined;
        throw new Error(errorData?.error || "Failed to create listing");
      }

      // Guard the side effects too, not just the request. If the seller moved
      // to another listing while this was in flight, clearing the local draft
      // and redirecting would act on the record they are on now.
      if (
        recordRef.current.generation !== capturedGeneration ||
        !matchesRoute(recordRef.current, routeIdRef.current)
      ) {
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      const product = (response.data ?? {}) as { title?: string };
      clearLocalDraft();

      if (isEditingListing) {
        router.push("/seller/listings?updated=1");
        return;
      }

      const successParams = new URLSearchParams({
        listed: "1",
        title: product.title || formData.title,
      });
      router.push(`/seller/listings?${successParams.toString()}`);
      // Note: Don't reset isSubmittingRef here - we're navigating away
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEditingListing
            ? "Failed to save changes"
            : "Failed to create listing"
      );
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

    // Same reasoning as handleSubmit: no safe write target until the record
    // being edited is on screen.
    if (!isRecordReadyToSave) {
      setError(RECORD_NOT_READY_MESSAGE);
      return;
    }

    isSubmittingRef.current = true;

    setLoading(true);
    setError(null);

    if (!hasMeaningfulDraftContent(formData)) {
      setError("Add at least one detail before saving a draft.");
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    // Queued like every other write; persistDraft re-checks the record when it
    // actually runs, and abandons if the form has moved on since.
    const capturedGeneration = record.generation;

    try {
      const result = await saveQueueRef.current!.enqueue(() => {
        return persistDraft(formData, capturedGeneration);
      });

      if (result === "skipped") {
        setError(RECORD_CHANGED_MESSAGE);
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }
      if (result !== "saved") {
        throw new Error("Failed to save draft");
      }

      // Same reasoning as publish: don't clear the local draft or redirect if
      // the seller has moved to a different listing while this was in flight.
      if (
        recordRef.current.generation !== capturedGeneration ||
        !matchesRoute(recordRef.current, routeIdRef.current)
      ) {
        setLoading(false);
        isSubmittingRef.current = false;
        return;
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
              <Heading level={2}>{isEditingListing ? "Edit listing" : "Sell an item"}</Heading>
              <SaveStatusIndicator status={autoSaveStatus} isEditingListing={isEditingListing} />
            </Row>
          </Column>

          {/* While an existing record is loading, the fields below still hold
              the previous listing's data (or nothing) and would be replaced
              wholesale when the response lands — so anything typed here would
              be silently discarded. Show the load instead of a form that eats
              input. */}
          {isLoadingRecord && (
            <Column gap="$md" alignItems="center" paddingVertical="$10">
              <Spinner size="lg" color="$primary" />
              <Text size="$4" color="$textSecondary">
                Loading your listing…
              </Text>
            </Column>
          )}

          {recordLoadFailed && (
            <Card variant="outlined" padding="$lg">
              <Column gap="$md" alignItems="center">
                <Text size="$5" fontWeight="600" color="$text">
                  We couldn&apos;t load this listing
                </Text>
                <Text size="$3" color="$textSecondary" textAlign="center">
                  Nothing has been changed. Reload the page to try again.
                </Text>
                <Button
                  butterVariant="primary"
                  size="$4"
                  onPress={() => router.push("/seller/listings")}
                >
                  Back to my listings
                </Button>
              </Column>
            </Card>
          )}

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
            {!isLoadingRecord && !recordLoadFailed && (
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
                                titleManuallyOverriddenRef.current = false;
                              } else {
                                // User completely replaced the auto-generated prefix
                                titleManuallyOverriddenRef.current = true;
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
                            <Text
                              flex={1}
                              size="$5"
                              color={formData.title ? "$text" : "$textMuted"}
                            >
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
                        onChange={(e) => handleCategoryChange(e.target.value)}
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
                            titleManuallyOverriddenRef.current = false;
                          }}
                          fetchSuggestions={async (query) => {
                            const res = await fetch(
                              `/api/brands?query=${encodeURIComponent(query)}`
                            );
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
                          <Text size="$4" fontWeight="500" color="$text">
                            Grip
                          </Text>
                          <Text size="$4" color="$primary" fontWeight="600">
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
                          <Text size="$4" fontWeight="500" color="$text">
                            Head
                          </Text>
                          <Text size="$4" color="$primary" fontWeight="600">
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
                          <Text size="$4" fontWeight="500" color="$text">
                            Shaft
                          </Text>
                          <Text size="$4" color="$primary" fontWeight="600">
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
                        <Text size="$6" fontWeight="600">
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
                      {isEditingListing ? (
                        <Button
                          size="$5"
                          onPress={() => router.push("/seller/listings")}
                          disabled={loading}
                          flex={1}
                        >
                          Cancel
                        </Button>
                      ) : (
                        <Button
                          size="$5"
                          onPress={handleSaveDraft}
                          disabled={loading || !isRecordReadyToSave}
                          flex={1}
                        >
                          {loading ? "Saving..." : "Save draft"}
                        </Button>
                      )}
                      {/* Use type="submit" for native form submission only - no onPress to prevent dual submission */}
                      <Button
                        size="$5"
                        disabled={loading || !isRecordReadyToSave}
                        type="submit"
                        flex={1}
                      >
                        {isEditingListing
                          ? loading
                            ? "Saving..."
                            : "Save changes"
                          : loading
                            ? "Publishing..."
                            : "List item"}
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
            )}
          </Card>
        </Column>
      </Column>
    </Column>
  );
}
