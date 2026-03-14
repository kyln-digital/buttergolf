import EasyPostClient from "@easypost/api";

// Initialize EasyPost client
const getEasyPostClient = () => {
  const apiKey = process.env.EASYPOST_API_KEY;
  if (!apiKey) {
    throw new Error("EASYPOST_API_KEY environment variable is not set");
  }
  return new EasyPostClient(apiKey);
};

// Address format for EasyPost
export interface ShippingAddress {
  name: string;
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  country?: string;
  phone?: string | null;
}

// Parcel dimensions (in cm and grams)
export interface ParcelDimensions {
  length: number; // cm
  width: number; // cm
  height: number; // cm
  weight: number; // grams
}

// Create shipping label via EasyPost
export async function createShippingLabel(
  fromAddress: ShippingAddress,
  toAddress: ShippingAddress,
  parcel: ParcelDimensions
) {
  try {
    const client = getEasyPostClient();

    console.info("Creating EasyPost shipment:", {
      from: fromAddress,
      to: toAddress,
      parcel,
    });

    // Create shipment
    const shipment = await client.Shipment.create({
      to_address: {
        name: toAddress.name,
        street1: toAddress.street1,
        street2: toAddress.street2 || undefined,
        city: toAddress.city,
        state: toAddress.state,
        zip: toAddress.zip,
        country: toAddress.country || "US",
        phone: toAddress.phone || undefined,
      },
      from_address: {
        name: fromAddress.name,
        street1: fromAddress.street1,
        street2: fromAddress.street2 || undefined,
        city: fromAddress.city,
        state: fromAddress.state,
        zip: fromAddress.zip,
        country: fromAddress.country || "US",
        phone: fromAddress.phone || undefined,
      },
      parcel: {
        length: parcel.length,
        width: parcel.width,
        height: parcel.height,
        weight: parcel.weight,
      },
    });

    console.info("Shipment created:", shipment.id);

    // Buy the cheapest rate
    if (!shipment.rates || shipment.rates.length === 0) {
      throw new Error("No shipping rates available for this shipment");
    }

    // Sort rates by price and select the cheapest
    const sortedRates = [...shipment.rates].sort(
      (a, b) => Number.parseFloat(a.rate) - Number.parseFloat(b.rate)
    );
    const cheapestRate = sortedRates[0];

    console.info("Buying rate:", {
      id: cheapestRate.id,
      carrier: cheapestRate.carrier,
      service: cheapestRate.service,
      rate: cheapestRate.rate,
    });

    // Purchase the label
    const purchasedShipment = await client.Shipment.buy(shipment.id, cheapestRate.id);

    console.info("Label purchased:", {
      id: purchasedShipment.id,
      labelUrl: purchasedShipment.postage_label?.label_url,
      trackingCode: purchasedShipment.tracking_code,
    });

    return {
      shipmentId: purchasedShipment.id,
      labelUrl: purchasedShipment.postage_label?.label_url || null,
      labelFormat: purchasedShipment.postage_label?.label_file_type || null,
      trackingCode: purchasedShipment.tracking_code || null,
      trackingUrl: purchasedShipment.tracker?.public_url || null,
      carrier: cheapestRate.carrier,
      service: cheapestRate.service,
      rate: Number.parseFloat(cheapestRate.rate),
    };
  } catch (error) {
    console.error("Error creating EasyPost shipping label:", error);

    // Log detailed error information
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    throw new Error(
      `Failed to create shipping label: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// Retrieve shipment information
export async function getShipment(shipmentId: string) {
  try {
    const client = getEasyPostClient();
    const shipment = await client.Shipment.retrieve(shipmentId);
    return shipment;
  } catch (error) {
    console.error("Error retrieving shipment:", error);
    throw new Error(
      `Failed to retrieve shipment: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// Retrieve tracker information
export async function getTracker(trackingCode: string) {
  try {
    const client = getEasyPostClient();
    const tracker = await client.Tracker.retrieve(trackingCode);
    return tracker;
  } catch (error) {
    console.error("Error retrieving tracker:", error);
    throw new Error(
      `Failed to retrieve tracker: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
