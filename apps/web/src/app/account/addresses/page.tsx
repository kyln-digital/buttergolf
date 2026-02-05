"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Column, Row, Heading, Text, Button, Input, Card } from "@buttergolf/ui";

interface Address {
  id: string;
  firstName: string;
  lastName: string;
  name?: string; // Legacy field for backwards compatibility
  street1: string;
  street2?: string;
  city: string;
  county: string; // UK: county instead of state
  state?: string; // Legacy field
  postcode: string; // UK: postcode instead of zip
  zip?: string; // Legacy field
  country: string;
  phone?: string;
  isDefault: boolean;
}

interface AddressFormData {
  firstName: string;
  lastName: string;
  street1: string;
  street2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

// UK postcode validation regex
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

function isValidUKPostcode(postcode: string): boolean {
  return UK_POSTCODE_REGEX.test(postcode.trim());
}

function formatUKPostcode(postcode: string): string {
  const cleaned = postcode.replace(/\s/g, "").toUpperCase();
  if (cleaned.length > 3) {
    return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
  }
  return cleaned;
}

// Form Label component
const FormLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <Row gap="$xs" marginBottom="$xs">
    <Text size="$3" weight="medium" color="$text">
      {children}
    </Text>
    {required && <Text color="$error">*</Text>}
  </Row>
);

export default function AddressesPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [postcodeError, setPostcodeError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AddressFormData>({
    firstName: "",
    lastName: "",
    street1: "",
    street2: "",
    city: "",
    county: "",
    postcode: "",
    country: "GB",
    phone: "",
    isDefault: false,
  });

  // Load addresses
  const loadAddresses = async () => {
    try {
      const response = await fetch("/api/addresses");
      if (!response.ok) throw new Error("Failed to load addresses");
      const data = await response.json();
      setAddresses(data);
    } catch (err) {
      setError("Failed to load addresses");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSignedIn) {
      loadAddresses();
    }
  }, [isSignedIn]);

  // Redirect if not signed in
  if (isLoaded && !isSignedIn) {
    router.push("/sign-in?redirect=/account/addresses");
    return null;
  }

  const handleSubmit = async () => {
    setError(null);
    setPostcodeError(null);

    // Validate required fields
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.street1 ||
      !formData.city ||
      !formData.postcode
    ) {
      setError("Please fill in all required fields");
      return;
    }

    // Validate UK postcode format
    if (!isValidUKPostcode(formData.postcode)) {
      setPostcodeError("Please enter a valid UK postcode (e.g., SW1A 1AA)");
      return;
    }

    // Format postcode correctly
    const formattedPostcode = formatUKPostcode(formData.postcode);

    try {
      const url = editingAddress ? `/api/addresses/${editingAddress.id}` : "/api/addresses";
      const method = editingAddress ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          postcode: formattedPostcode,
          // Send combined name for backward compatibility with API
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          // Map UK fields to legacy API fields
          state: formData.county,
          zip: formattedPostcode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save address");
      }

      // Reload addresses and close form
      await loadAddresses();
      setShowForm(false);
      setEditingAddress(null);
      setFormData({
        firstName: "",
        lastName: "",
        street1: "",
        street2: "",
        city: "",
        county: "",
        postcode: "",
        country: "GB",
        phone: "",
        isDefault: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save address");
    }
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    // Parse name into first/last if legacy name exists
    const nameParts = (address.name || "").split(" ");
    const firstName = address.firstName || nameParts[0] || "";
    const lastName = address.lastName || nameParts.slice(1).join(" ") || "";

    setFormData({
      firstName,
      lastName,
      street1: address.street1,
      street2: address.street2 || "",
      city: address.city,
      county: address.county || address.state || "",
      postcode: address.postcode || address.zip || "",
      country: address.country,
      phone: address.phone || "",
      isDefault: address.isDefault,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;

    try {
      const response = await fetch(`/api/addresses/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete address");
      await loadAddresses();
    } catch (err) {
      console.error("Failed to delete address:", err);
      setError("Failed to delete address");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch(`/api/addresses/${id}/default`, {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to update default address");
      await loadAddresses();
    } catch (err) {
      console.error("Failed to update default address:", err);
      setError("Failed to update default address");
    }
  };

  if (loading) {
    return (
      <Column alignItems="center" justifyContent="center" width="100%" padding="$xl">
        <Text>Loading addresses...</Text>
      </Column>
    );
  }

  return (
    <Column
      maxWidth={800}
      paddingHorizontal="$6"
      width="100%"
      alignSelf="center"
      marginHorizontal="auto"
    >
      <Column gap="$xl" paddingVertical="$6" width="100%">
        {/* Header */}
        <Row justifyContent="space-between" alignItems="center" width="100%">
          <Column gap="$sm">
            <Button chromeless size="$3" onPress={() => router.push("/account")}>
              ← Back to Account
            </Button>
            <Heading level={2}>Shipping Addresses</Heading>
            <Text color="$textSecondary">Manage addresses where you can ship items from</Text>
          </Column>
          <Button butterVariant="primary" size="$4" onPress={() => setShowForm(true)}>
            Add Address
          </Button>
        </Row>

        {error && (
          <Card variant="filled" padding="$md" backgroundColor="$errorLight">
            <Text color="$error">{error}</Text>
          </Card>
        )}

        {/* Address Form */}
        {showForm && (
          <Card variant="elevated" padding="$lg">
            <Column gap="$lg">
              <Row justifyContent="space-between" alignItems="center">
                <Heading level={3}>{editingAddress ? "Edit Address" : "Add New Address"}</Heading>
                <Button
                  chromeless
                  size="$3"
                  onPress={() => {
                    setShowForm(false);
                    setEditingAddress(null);
                  }}
                >
                  Cancel
                </Button>
              </Row>

              <Column gap="$md">
                {/* Name Row - First and Last */}
                <Row gap="$md" flexWrap="wrap">
                  <Column gap="$xs" flex={1} minWidth={150}>
                    <FormLabel required>First Name</FormLabel>
                    <Input
                      value={formData.firstName}
                      onChangeText={(value) => setFormData({ ...formData, firstName: value })}
                      placeholder="John"
                      size="$4"
                      autoComplete="given-name"
                    />
                  </Column>
                  <Column gap="$xs" flex={1} minWidth={150}>
                    <FormLabel required>Last Name</FormLabel>
                    <Input
                      value={formData.lastName}
                      onChangeText={(value) => setFormData({ ...formData, lastName: value })}
                      placeholder="Smith"
                      size="$4"
                      autoComplete="family-name"
                    />
                  </Column>
                </Row>

                {/* Street Address 1 */}
                <Column gap="$xs">
                  <FormLabel required>Address Line 1</FormLabel>
                  <Input
                    value={formData.street1}
                    onChangeText={(value) => setFormData({ ...formData, street1: value })}
                    placeholder="10 Downing Street"
                    size="$4"
                    autoComplete="address-line1"
                  />
                </Column>

                {/* Street Address 2 */}
                <Column gap="$xs">
                  <FormLabel>Address Line 2 (Optional)</FormLabel>
                  <Input
                    value={formData.street2}
                    onChangeText={(value) => setFormData({ ...formData, street2: value })}
                    placeholder="Flat 2B"
                    size="$4"
                    autoComplete="address-line2"
                  />
                </Column>

                {/* City and County Row */}
                <Row gap="$md" flexWrap="wrap">
                  <Column gap="$xs" flex={2} minWidth={200}>
                    <FormLabel required>Town/City</FormLabel>
                    <Input
                      value={formData.city}
                      onChangeText={(value) => setFormData({ ...formData, city: value })}
                      placeholder="London"
                      size="$4"
                      autoComplete="address-level2"
                    />
                  </Column>
                  <Column gap="$xs" flex={1} minWidth={150}>
                    <FormLabel>County</FormLabel>
                    <Input
                      value={formData.county}
                      onChangeText={(value) => setFormData({ ...formData, county: value })}
                      placeholder="Greater London"
                      size="$4"
                      autoComplete="address-level1"
                    />
                  </Column>
                </Row>

                {/* Postcode */}
                <Column gap="$xs">
                  <FormLabel required>Postcode</FormLabel>
                  <Input
                    value={formData.postcode}
                    onChangeText={(value) => {
                      setFormData({ ...formData, postcode: value });
                      setPostcodeError(null);
                    }}
                    placeholder="SW1A 1AA"
                    size="$4"
                    autoComplete="postal-code"
                  />
                  {postcodeError && (
                    <Text size="$3" color="$error">
                      {postcodeError}
                    </Text>
                  )}
                </Column>

                {/* Phone */}
                <Column gap="$xs">
                  <FormLabel>Phone Number</FormLabel>
                  <Input
                    value={formData.phone}
                    onChangeText={(value) => setFormData({ ...formData, phone: value })}
                    placeholder="+44 7700 900000"
                    size="$4"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </Column>

                {/* Default Address Checkbox */}
                <Row gap="$sm" alignItems="center">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isDefault: e.target.checked,
                      })
                    }
                    id="isDefault"
                  />
                  <Text
                    size="$3"
                    color="$text"
                    onPress={() =>
                      setFormData({
                        ...formData,
                        isDefault: !formData.isDefault,
                      })
                    }
                  >
                    Set as default shipping address
                  </Text>
                </Row>
              </Column>

              <Button butterVariant="primary" size="$5" onPress={handleSubmit}>
                {editingAddress ? "Update Address" : "Save Address"}
              </Button>
            </Column>
          </Card>
        )}

        {/* Addresses List */}
        <Column gap="$md" width="100%">
          {addresses.length === 0 ? (
            <Card variant="outlined" padding="$xl">
              <Column gap="$md" alignItems="center">
                <Text size="$10">📦</Text>
                <Column gap="$sm" alignItems="center">
                  <Heading level={4}>No shipping addresses yet</Heading>
                  <Text color="$textSecondary" textAlign="center">
                    Add a shipping address to start selling items on ButterGolf
                  </Text>
                </Column>
                <Button butterVariant="primary" size="$4" onPress={() => setShowForm(true)}>
                  Add Your First Address
                </Button>
              </Column>
            </Card>
          ) : (
            addresses.map((address) => (
              <Card key={address.id} variant="elevated" padding="$lg" width="100%">
                <Row justifyContent="space-between" alignItems="flex-start">
                  <Column gap="$sm" flex={1}>
                    <Row gap="$sm" alignItems="center">
                      <Text size="$6" weight="semibold">
                        {address.firstName && address.lastName
                          ? `${address.firstName} ${address.lastName}`
                          : address.name}
                      </Text>
                      {address.isDefault && (
                        <Text
                          size="$2"
                          backgroundColor="$primary"
                          color="$white"
                          paddingHorizontal="$sm"
                          paddingVertical="$xs"
                          borderRadius="$sm"
                        >
                          DEFAULT
                        </Text>
                      )}
                    </Row>
                    <Column gap="$xs">
                      <Text color="$textSecondary">{address.street1}</Text>
                      {address.street2 && <Text color="$textSecondary">{address.street2}</Text>}
                      <Text color="$textSecondary">
                        {address.city}
                        {(address.county || address.state) &&
                          `, ${address.county || address.state}`}{" "}
                        {address.postcode || address.zip}
                      </Text>
                      {address.phone && <Text color="$textSecondary">{address.phone}</Text>}
                    </Column>
                  </Column>
                  <Row gap="$sm">
                    {!address.isDefault && (
                      <Button chromeless size="$3" onPress={() => handleSetDefault(address.id)}>
                        Set Default
                      </Button>
                    )}
                    <Button chromeless size="$3" onPress={() => handleEdit(address)}>
                      Edit
                    </Button>
                    <Button
                      chromeless
                      size="$3"
                      color="$error"
                      onPress={() => handleDelete(address.id)}
                    >
                      Delete
                    </Button>
                  </Row>
                </Row>
              </Card>
            ))
          )}
        </Column>
      </Column>
    </Column>
  );
}
