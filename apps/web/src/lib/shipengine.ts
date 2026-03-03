import { prisma } from "@buttergolf/db";
import { SHIPENGINE_CARRIER_CODES } from "./constants";
import { buildTrackingUrl } from "./utils/format";
import { sendLabelGeneratedEmail } from "./email";
import {
  validateUKAddress,
  validateSellerCanShip,
  normalizeUKPostcode,
  AddressErrorCode,
  type AddressValidationError,
  type ShippingAddress,
} from "./address-validation";

// ShipEngine API client for UK shipping
const SHIPENGINE_API_KEY = process.env.SHIPENGINE_API_KEY;
const SHIPENGINE_BASE_URL = "https://api.shipengine.com";

export interface ShippingCalculationRequest {
  productId: string;
  toAddress: {
    street1: string;
    street2?: string;
    city: string;
    state?: string; // county for UK
    zip: string; // postcode for UK
    country?: string;
  };
  fromAddressId?: string;
}

export interface ShippingRate {
  carrier: string;
  service: string;
  rate: string; // Price in pence
  rateDisplay: string; // Formatted price for display
  estimatedDays: number;
  deliveryDate?: string;
  id?: string; // ShipEngine rate ID
}

export interface ShippingCalculationResult {
  rates: ShippingRate[];
  fromAddress: {
    city: string;
    state: string;
    zip: string;
  };
  toAddress: ShippingCalculationRequest["toAddress"];
  dimensions: {
    length: number;
    width: number;
    height: number;
    weight: number;
  };
  fallback?: boolean;
  cached?: boolean;
}

export interface ShippingValidationError {
  code: AddressErrorCode | "PRODUCT_NOT_FOUND" | "PRODUCT_SOLD" | "NO_RATES_AVAILABLE";
  message: string;
  field?: string;
  errors?: AddressValidationError[];
}

// Cache TTL for shipping rates (15 minutes)
const SHIPPING_RATE_CACHE_TTL = 15 * 60 * 1000; // ms

// In-memory shipping rate cache (replaces Redis)
const rateCache = new Map<string, { data: unknown; expiry: number }>();

async function cacheGetOrSet<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = rateCache.get(key);
  if (hit && hit.expiry > now) return hit.data as T;
  const data = await fn();
  rateCache.set(key, { data, expiry: now + ttlMs });
  return data;
}

interface ShipEngineRateResponse {
  rate_response: {
    rates: Array<{
      rate_id: string;
      carrier_friendly_name: string;
      service_type: string;
      shipping_amount: {
        currency: string;
        amount: number;
      };
      delivery_days: number;
      estimated_delivery_date?: string;
    }>;
    errors?: Array<{
      message: string;
    }>;
  };
}

/**
 * Call ShipEngine API with timeout and retry logic
 */
async function shipEngineRequest<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
  retryCount = 0
): Promise<T> {
  if (!SHIPENGINE_API_KEY) {
    throw new Error("ShipEngine API key not configured");
  }

  // Set up timeout controller (10 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${SHIPENGINE_BASE_URL}${endpoint}`, {
      method,
      headers: {
        "API-Key": SHIPENGINE_API_KEY,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle rate limiting (429) with exponential backoff
    if (response.status === 429 && retryCount < 3) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterSeconds = retryAfterHeader
        ? parseInt(retryAfterHeader, 10)
        : Math.pow(2, retryCount) * 2; // Exponential backoff: 2s, 4s, 8s

      console.warn(
        `ShipEngine rate limit hit. Retrying in ${retryAfterSeconds}s (attempt ${retryCount + 1}/3)`
      );

      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));

      return shipEngineRequest<T>(endpoint, method, body, retryCount + 1);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ShipEngine API error: ${response.status} - ${errorText}`);
      throw new Error(`ShipEngine API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout errors
    if (error instanceof Error && error.name === "AbortError") {
      console.error("ShipEngine API request timed out after 10 seconds");
      throw new Error("ShipEngine API request timed out");
    }

    throw error;
  }
}

/**
 * Build a cache key for shipping rates.
 * Format: shipping:rates:{fromPostcode}:{toPostcode}:{dimensionsHash}
 *
 * Uses dimensions hash instead of productId so:
 * - Cache is reusable across products with similar dimensions
 * - Dimension updates invalidate stale cached rates automatically
 */
function buildRateCacheKey(
  fromPostcode: string,
  toPostcode: string,
  dimensions: { length: number; width: number; height: number; weight: number }
): string {
  const normalisedFrom = normalizeUKPostcode(fromPostcode).replace(/\s/g, "");
  const normalisedTo = normalizeUKPostcode(toPostcode).replace(/\s/g, "");
  // Create a simple hash from dimensions (L x W x H @ Weight)
  const dimensionsHash = `${dimensions.length}x${dimensions.width}x${dimensions.height}@${dimensions.weight}`;
  return `shipping:rates:${normalisedFrom}:${normalisedTo}:${dimensionsHash}`;
}

/**
 * Calculate shipping rates using ShipEngine API with validation and caching.
 *
 * Features:
 * - Validates buyer and seller addresses before API call
 * - Caches rates for 15 minutes by from/to postcode and product
 * - Falls back to estimated rates if ShipEngine fails
 * - Returns structured errors for validation failures
 *
 * @throws {ShippingValidationError} When validation fails
 */
export async function calculateShippingRates(
  request: ShippingCalculationRequest
): Promise<ShippingCalculationResult> {
  const { productId, toAddress, fromAddressId } = request;

  // Validate required fields
  if (!productId) {
    const error: ShippingValidationError = {
      code: "PRODUCT_NOT_FOUND",
      message: "Product ID is required",
    };
    throw error;
  }

  // Validate buyer's address
  const buyerValidation = validateUKAddress(toAddress as ShippingAddress);
  if (!buyerValidation.isValid) {
    const error: ShippingValidationError = {
      code: buyerValidation.errors[0].code,
      message: buyerValidation.errors[0].message,
      field: buyerValidation.errors[0].field,
      errors: buyerValidation.errors,
    };
    throw error;
  }

  // Get product with seller information
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      user: {
        include: {
          addresses: {
            where: fromAddressId ? { id: fromAddressId } : { isDefault: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!product) {
    const error: ShippingValidationError = {
      code: "PRODUCT_NOT_FOUND",
      message: "Product not found",
    };
    throw error;
  }

  if (product.isSold) {
    const error: ShippingValidationError = {
      code: "PRODUCT_SOLD",
      message: "This product has already been sold",
    };
    throw error;
  }

  // Get and validate seller's address
  const fromAddress = product.user.addresses[0];
  const sellerValidation = validateSellerCanShip(fromAddress as ShippingAddress | null);
  if (!sellerValidation.canShip) {
    const error: ShippingValidationError = {
      code: sellerValidation.error!.code,
      message: sellerValidation.error!.message,
    };
    throw error;
  }

  // Get shipping dimensions (use defaults if not provided)
  const dimensions = {
    length: product.length || 30, // cm
    width: product.width || 20, // cm
    height: product.height || 10, // cm
    weight: product.weight || 500, // grams
  };

  // Build cache key for rate lookup (uses dimensions for better cache reuse)
  const cacheKey = buildRateCacheKey(fromAddress.zip, toAddress.zip, dimensions);

  // Try to get cached or fresh shipping rates from ShipEngine
  if (SHIPENGINE_API_KEY) {
    try {
      // Use cache-aside pattern for rate lookup
      const cachedResult = await cacheGetOrSet<ShippingCalculationResult | null>(
        cacheKey,
        SHIPPING_RATE_CACHE_TTL,
        () => fetchShipEngineRates(fromAddress, toAddress, dimensions)
      );

      if (cachedResult && cachedResult.rates.length > 0) {
        return {
          ...cachedResult,
          fromAddress: {
            city: fromAddress.city,
            state: fromAddress.state,
            zip: fromAddress.zip,
          },
          toAddress,
          dimensions,
          cached: true,
        };
      }
    } catch (shipEngineError: unknown) {
      console.warn("ShipEngine API error, falling back to estimation:", shipEngineError);
      // Fall through to fallback calculation
    }
  }

  // Fallback calculation if ShipEngine is not available or fails
  return getFallbackRates(fromAddress, toAddress, dimensions);
}

/**
 * Fetch shipping rates from ShipEngine API.
 * Separated for caching - this is the expensive operation.
 */
async function fetchShipEngineRates(
  fromAddress: {
    name: string;
    street1: string;
    street2: string | null;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone: string | null;
  },
  toAddress: ShippingCalculationRequest["toAddress"],
  dimensions: { length: number; width: number; height: number; weight: number }
): Promise<ShippingCalculationResult | null> {
  try {
    // ShipEngine expects dimensions in inches and weight in ounces/pounds
    // Convert from cm to inches and grams to ounces
    const lengthInches = dimensions.length / 2.54;
    const widthInches = dimensions.width / 2.54;
    const heightInches = dimensions.height / 2.54;
    const weightOunces = dimensions.weight / 28.3495;

    const rateRequest = {
      rate_options: {
        carrier_ids: [], // Will use all connected carriers
        service_codes: [],
        calculate_tax_amount: false,
      },
      shipment: {
        ship_from: {
          name: fromAddress.name,
          address_line1: fromAddress.street1,
          address_line2: fromAddress.street2 || undefined,
          city_locality: fromAddress.city,
          state_province: fromAddress.state || "",
          postal_code: fromAddress.zip,
          country_code: fromAddress.country || "GB",
          phone: fromAddress.phone || undefined,
        },
        ship_to: {
          name: "Buyer",
          address_line1: toAddress.street1,
          address_line2: toAddress.street2 || undefined,
          city_locality: toAddress.city,
          state_province: toAddress.state || "",
          postal_code: toAddress.zip,
          country_code: toAddress.country || "GB",
        },
        packages: [
          {
            weight: {
              value: weightOunces,
              unit: "ounce",
            },
            dimensions: {
              length: lengthInches,
              width: widthInches,
              height: heightInches,
              unit: "inch",
            },
          },
        ],
      },
    };

    const response = await shipEngineRequest<ShipEngineRateResponse>(
      "/v1/rates",
      "POST",
      rateRequest
    );

    if (response.rate_response.errors?.length) {
      console.warn("ShipEngine rate errors:", response.rate_response.errors);
    }

    // Process rates
    const rates: ShippingRate[] = response.rate_response.rates
      .filter((rate) => rate.shipping_amount.amount > 0)
      .slice(0, 5) // Limit to 5 options
      .map((rate) => {
        // Convert to pence (ShipEngine returns GBP for UK)
        const amountInPence = Math.ceil(rate.shipping_amount.amount * 100);
        return {
          carrier: rate.carrier_friendly_name || "Unknown",
          service: rate.service_type || "Standard",
          rate: amountInPence.toString(),
          rateDisplay: `£${(amountInPence / 100).toFixed(2)}`,
          estimatedDays: rate.delivery_days || 5,
          deliveryDate: rate.estimated_delivery_date || undefined,
          id: rate.rate_id,
        };
      });

    // Sort by price (cheapest first)
    rates.sort((a, b) => Number.parseInt(a.rate) - Number.parseInt(b.rate));

    if (rates.length > 0) {
      return {
        rates,
        fromAddress: {
          city: fromAddress.city,
          state: fromAddress.state,
          zip: fromAddress.zip,
        },
        toAddress,
        dimensions: {
          length: dimensions.length,
          width: dimensions.width,
          height: dimensions.height,
          weight: dimensions.weight,
        },
      };
    }

    return null;
  } catch (error) {
    console.warn("ShipEngine API error in fetchShipEngineRates:", error);
    return null;
  }
}

/**
 * Get fallback rates when ShipEngine is unavailable.
 * UK-specific carriers and pricing in GBP (pence).
 */
function getFallbackRates(
  fromAddress: { city: string; state: string; zip: string },
  toAddress: ShippingCalculationRequest["toAddress"],
  dimensions: { length: number; width: number; height: number; weight: number }
): ShippingCalculationResult {
  const fallbackRates: ShippingRate[] = [
    {
      carrier: "Royal Mail",
      service: "Tracked 48",
      rate: "499", // £4.99 in pence
      rateDisplay: "£4.99",
      estimatedDays: 3,
    },
    {
      carrier: "Royal Mail",
      service: "Tracked 24",
      rate: "699", // £6.99 in pence
      rateDisplay: "£6.99",
      estimatedDays: 1,
    },
    {
      carrier: "Evri",
      service: "Standard",
      rate: "399", // £3.99 in pence
      rateDisplay: "£3.99",
      estimatedDays: 5,
    },
    {
      carrier: "DPD",
      service: "Next Day",
      rate: "899", // £8.99 in pence
      rateDisplay: "£8.99",
      estimatedDays: 1,
    },
  ];

  return {
    rates: fallbackRates,
    fallback: true,
    fromAddress: {
      city: fromAddress.city,
      state: fromAddress.state,
      zip: fromAddress.zip,
    },
    toAddress,
    dimensions,
  };
}

/**
 * Quick shipping rate estimation (for product pages)
 */
export async function estimateShippingRate(
  productId: string,
  postcode: string,
  county: string = ""
): Promise<{
  estimatedRate: number;
  estimatedDisplay: string;
  fromPostcode: string;
  toPostcode: string;
  note: string;
}> {
  // Get product
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      user: {
        include: {
          addresses: {
            where: { isDefault: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  if (product.isSold) {
    throw new Error("Product is already sold");
  }

  // Quick estimate without full address
  const fromAddress = product.user.addresses[0];
  if (!fromAddress) {
    throw new Error("Seller has no shipping address configured");
  }

  // Use simplified calculation for quick estimates (UK pricing in pence)
  const baseRate = 499; // £4.99 base rate
  const weight = product.weight || 500;

  // Add £1 for every 500g over 500g
  const weightSurcharge = Math.max(0, Math.floor((weight - 500) / 500)) * 100;

  const estimatedRate = baseRate + weightSurcharge;

  return {
    estimatedRate,
    estimatedDisplay: `£${(estimatedRate / 100).toFixed(2)}`,
    fromPostcode: fromAddress.zip,
    toPostcode: postcode,
    note: `Estimate to ${postcode}${county ? `, ${county}` : ""} only - actual rates calculated at checkout`,
  };
}

// ============================================================================
// LABEL GENERATION
// ============================================================================

export interface LabelGenerationResult {
  labelId: string;
  shipmentId: string;
  trackingNumber: string;
  trackingUrl: string;
  labelUrl: string;
  labelPngUrl: string | null;
  labelZplUrl: string | null;
  carrier: string;
  service: string;
  estimatedDelivery?: string;
}

interface ShipEngineLabelResponse {
  label_id: string;
  shipment_id: string;
  tracking_number: string;
  carrier_code: string;
  service_code: string;
  label_download: {
    pdf: string;
    png: string;
    zpl: string;
    href: string;
  };
  tracking_status: string;
  ship_date: string;
  estimated_delivery_date?: string;
}

/**
 * Generate a shipping label for an order using ShipEngine
 * Uses the shipping amount already paid at checkout
 */
export async function generateShippingLabel(params: {
  orderId: string;
}): Promise<LabelGenerationResult> {
  const { orderId } = params;

  if (!SHIPENGINE_API_KEY) {
    throw new Error("ShipEngine API key not configured");
  }

  // Get order with all required data
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      product: true,
      fromAddress: true,
      toAddress: true,
      seller: true,
      buyer: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.labelUrl) {
    throw new Error("Label already generated for this order");
  }

  // Validate seller address using comprehensive validation
  const sellerAddressValidation = validateUKAddress(
    {
      street1: order.fromAddress.street1,
      street2: order.fromAddress.street2 || undefined,
      city: order.fromAddress.city,
      state: order.fromAddress.state || undefined,
      zip: order.fromAddress.zip,
      country: order.fromAddress.country || "GB",
      phone: order.fromAddress.phone || undefined,
    },
    { isSeller: true }
  );

  if (!sellerAddressValidation.isValid) {
    const firstError = sellerAddressValidation.errors[0];
    throw new Error(
      firstError.code === AddressErrorCode.SELLER_ADDRESS_INCOMPLETE
        ? "Seller must update their shipping address before generating a label"
        : `Invalid seller address: ${firstError.message}`
    );
  }

  // Prepare dimensions
  const dimensions = {
    length: order.product.length || 30,
    width: order.product.width || 20,
    height: order.product.height || 10,
    weight: order.product.weight || 500,
  };

  // Convert to imperial (ShipEngine prefers inches/ounces)
  const lengthInches = dimensions.length / 2.54;
  const widthInches = dimensions.width / 2.54;
  const heightInches = dimensions.height / 2.54;
  const weightOunces = dimensions.weight / 28.3495;

  // Get rates to find the best matching rate for the shipping cost
  const rateRequest = {
    rate_options: {
      carrier_ids: [],
    },
    shipment: {
      ship_from: {
        name: order.fromAddress.name || `${order.seller.firstName} ${order.seller.lastName}`.trim(),
        address_line1: order.fromAddress.street1,
        address_line2: order.fromAddress.street2 || undefined,
        city_locality: order.fromAddress.city,
        state_province: order.fromAddress.state || "",
        postal_code: order.fromAddress.zip,
        country_code: order.fromAddress.country || "GB",
        phone: order.fromAddress.phone || undefined,
      },
      ship_to: {
        name: order.toAddress.name || `${order.buyer.firstName} ${order.buyer.lastName}`.trim(),
        address_line1: order.toAddress.street1,
        address_line2: order.toAddress.street2 || undefined,
        city_locality: order.toAddress.city,
        state_province: order.toAddress.state || "",
        postal_code: order.toAddress.zip,
        country_code: order.toAddress.country || "GB",
        phone: order.toAddress.phone || undefined,
      },
      packages: [
        {
          weight: {
            value: weightOunces,
            unit: "ounce",
          },
          dimensions: {
            length: lengthInches,
            width: widthInches,
            height: heightInches,
            unit: "inch",
          },
        },
      ],
    },
  };

  // Get available rates
  const ratesResponse = await shipEngineRequest<ShipEngineRateResponse>(
    "/v1/rates",
    "POST",
    rateRequest
  );

  // Find a rate that fits within the shipping budget
  const availableRates = ratesResponse.rate_response.rates
    .filter((rate) => rate.shipping_amount.amount > 0)
    .sort((a, b) => a.shipping_amount.amount - b.shipping_amount.amount);

  if (availableRates.length === 0) {
    throw new Error("No shipping rates available for this route");
  }

  // Select the best rate within budget, or the cheapest if all are over budget
  const budgetInCurrency = order.shippingCost;
  let selectedRate = availableRates.find((rate) => rate.shipping_amount.amount <= budgetInCurrency);

  if (!selectedRate) {
    // Use cheapest if nothing within budget (platform absorbs the difference)
    selectedRate = availableRates[0];
    console.warn(
      `No rate within budget (£${budgetInCurrency}), using cheapest: £${selectedRate.shipping_amount.amount}`
    );
  }

  // Create the label using the selected rate.
  // ShipEngine always returns PDF, PNG, and ZPL URLs in label_download regardless
  // of label_format. label_format only controls which URL label_download.href points to.
  const labelRequest = {
    rate_id: selectedRate.rate_id,
    label_format: "pdf",
    label_layout: "4x6",
    label_download_type: "url",
  };

  const labelResponse = await shipEngineRequest<ShipEngineLabelResponse>(
    "/v1/labels",
    "POST",
    labelRequest
  );

  // Build carrier-specific tracking URL
  const trackingUrl = buildTrackingUrl(
    selectedRate.carrier_friendly_name,
    labelResponse.tracking_number
  );

  // Update order in database with all label format URLs (PDF, PNG, ZPL)
  await prisma.order.update({
    where: { id: orderId },
    data: {
      shipEngineShipmentId: labelResponse.shipment_id,
      shipEngineRateId: selectedRate.rate_id,
      labelUrl: labelResponse.label_download.pdf,
      labelPngUrl: labelResponse.label_download?.png ?? null,
      labelZplUrl: labelResponse.label_download?.zpl ?? null,
      labelFormat: "pdf", // Primary label URL is PDF; PNG/ZPL stored separately
      trackingCode: labelResponse.tracking_number,
      trackingUrl: trackingUrl,
      carrier: selectedRate.carrier_friendly_name,
      service: selectedRate.service_type,
      labelGeneratedAt: new Date(),
      status: "LABEL_GENERATED",
      shipmentStatus: "PRE_TRANSIT",
      estimatedDelivery: selectedRate.estimated_delivery_date
        ? new Date(selectedRate.estimated_delivery_date)
        : undefined,
    },
  });

  // Send email notification to buyer
  try {
    const buyer = await prisma.user.findUnique({
      where: { id: order.buyerId },
    });
    const product = await prisma.product.findUnique({
      where: { id: order.productId },
      select: { title: true },
    });

    if (buyer && product) {
      const buyerName = `${buyer.firstName || ""} ${buyer.lastName || ""}`.trim() || buyer.email;
      await sendLabelGeneratedEmail({
        buyerEmail: buyer.email,
        buyerName,
        orderId: order.id,
        productTitle: product.title,
        estimatedDelivery: selectedRate.estimated_delivery_date,
        carrier: selectedRate.carrier_friendly_name,
      });
      console.info("Sent label generated email to buyer");
    }
  } catch (emailError) {
    // Don't fail label generation if email fails
    console.error("Error sending label generated email:", emailError);
  }

  return {
    labelId: labelResponse.label_id,
    shipmentId: labelResponse.shipment_id,
    trackingNumber: labelResponse.tracking_number,
    trackingUrl,
    labelUrl: labelResponse.label_download.pdf,
    labelPngUrl: labelResponse.label_download?.png ?? null,
    labelZplUrl: labelResponse.label_download?.zpl ?? null,
    carrier: selectedRate.carrier_friendly_name,
    service: selectedRate.service_type,
    estimatedDelivery: selectedRate.estimated_delivery_date,
  };
}

/**
 * Get tracking information for an order
 */
export async function getOrderTracking(orderId: string): Promise<{
  status: string;
  statusDescription: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  events: Array<{
    date: string;
    description: string;
    location?: string;
  }>;
} | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order || !order.trackingCode || !order.carrier) {
    return null;
  }

  try {
    // Map carrier name to ShipEngine carrier code
    const carrierCode = SHIPENGINE_CARRIER_CODES[order.carrier] || "stamps_com";

    const response = await shipEngineRequest<{
      tracking_number: string;
      status_code: string;
      status_description: string;
      estimated_delivery_date?: string;
      actual_delivery_date?: string;
      events: Array<{
        occurred_at: string;
        description: string;
        city_locality?: string;
        state_province?: string;
        country_code?: string;
      }>;
    }>(`/v1/tracking?carrier_code=${carrierCode}&tracking_number=${order.trackingCode}`);

    return {
      status: response.status_code,
      statusDescription: response.status_description,
      estimatedDelivery: response.estimated_delivery_date,
      actualDelivery: response.actual_delivery_date,
      events: response.events.map((event) => ({
        date: event.occurred_at,
        description: event.description,
        location: [event.city_locality, event.state_province, event.country_code]
          .filter(Boolean)
          .join(", "),
      })),
    };
  } catch (error) {
    console.error("Error fetching tracking:", error);
    return null;
  }
}
