"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Column, Row, Text, Button, Heading, Spinner, ScrollView, Input } from "@buttergolf/ui";
import { Button as TamaguiButton, View, Switch } from "tamagui";
import { ArrowLeft, Plus, MapPin, Check, Trash2, Edit3 } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "react-native";

interface Address {
  id: string;
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
}

export interface AddressesScreenProps {
  /** Fetch user's addresses */
  onFetchAddresses: () => Promise<Address[]>;
  /** Create a new address */
  onCreateAddress: (address: Omit<Address, "id">) => Promise<Address>;
  /** Update an existing address */
  onUpdateAddress: (id: string, address: Partial<Address>) => Promise<Address>;
  /** Delete an address */
  onDeleteAddress: (id: string) => Promise<void>;
  /** Set an address as default */
  onSetDefault: (id: string) => Promise<void>;
  /** Navigate back */
  onBack: () => void;
}

type ViewMode = "list" | "add" | "edit";

const emptyAddress: Omit<Address, "id"> = {
  name: "",
  street1: "",
  street2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "GB",
  phone: "",
  isDefault: false,
};

export function AddressesScreen({
  onFetchAddresses,
  onCreateAddress,
  onUpdateAddress,
  onDeleteAddress,
  onSetDefault,
  onBack,
}: Readonly<AddressesScreenProps>) {
  const insets = useSafeAreaInsets();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState<Omit<Address, "id">>(emptyAddress);
  const [error, setError] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    try {
      setError(null);
      const data = await onFetchAddresses();
      setAddresses(data);
    } catch (err) {
      console.error("Failed to fetch addresses:", err);
      setError("Failed to load addresses");
    } finally {
      setLoading(false);
    }
  }, [onFetchAddresses]);

  useEffect(() => {
    void fetchAddresses();
  }, [fetchAddresses]);

  const handleAddNew = useCallback(() => {
    setFormData(emptyAddress);
    setEditingAddress(null);
    setViewMode("add");
  }, []);

  const handleEdit = useCallback((address: Address) => {
    setFormData({
      name: address.name,
      street1: address.street1,
      street2: address.street2 || "",
      city: address.city,
      state: address.state || "",
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone || "",
      isDefault: address.isDefault,
    });
    setEditingAddress(address);
    setViewMode("edit");
  }, []);

  const handleDelete = useCallback(
    (address: Address) => {
      Alert.alert("Delete Address", `Are you sure you want to delete "${address.name}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await onDeleteAddress(address.id);
              void fetchAddresses();
            } catch (err) {
              Alert.alert("Error", "Failed to delete address");
            }
          },
        },
      ]);
    },
    [onDeleteAddress, fetchAddresses]
  );

  const handleSetDefault = useCallback(
    async (address: Address) => {
      try {
        await onSetDefault(address.id);
        void fetchAddresses();
      } catch (err) {
        Alert.alert("Error", "Failed to set default address");
      }
    },
    [onSetDefault, fetchAddresses]
  );

  const handleSave = useCallback(async () => {
    // Validation
    if (!formData.name.trim()) {
      Alert.alert("Error", "Please enter a name for this address");
      return;
    }
    if (!formData.street1.trim()) {
      Alert.alert("Error", "Please enter a street address");
      return;
    }
    if (!formData.city.trim()) {
      Alert.alert("Error", "Please enter a city");
      return;
    }
    if (!formData.postalCode.trim()) {
      Alert.alert("Error", "Please enter a postal code");
      return;
    }

    setSaving(true);
    try {
      if (editingAddress) {
        await onUpdateAddress(editingAddress.id, formData);
      } else {
        await onCreateAddress(formData);
      }
      await fetchAddresses();
      setViewMode("list");
    } catch (err) {
      console.error("Failed to save address:", err);
      Alert.alert("Error", "Failed to save address. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [formData, editingAddress, onCreateAddress, onUpdateAddress, fetchAddresses]);

  const handleCancel = useCallback(() => {
    setViewMode("list");
    setFormData(emptyAddress);
    setEditingAddress(null);
  }, []);

  // Render form view
  if (viewMode === "add" || viewMode === "edit") {
    return (
      <Column flex={1} backgroundColor="$background" paddingTop={insets.top}>
        {/* Header */}
        <Row
          paddingHorizontal="$4"
          paddingVertical="$3"
          alignItems="center"
          gap="$3"
          borderBottomWidth={1}
          borderBottomColor="$border"
        >
          <TamaguiButton
            chromeless
            circular
            size="$4"
            onPress={handleCancel}
            icon={<ArrowLeft size={24} color="$text" />}
          />
          <Heading level={4} flex={1}>
            {viewMode === "add" ? "Add Address" : "Edit Address"}
          </Heading>
          <TamaguiButton chromeless size="$4" onPress={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" color="$primary" /> : <Check size={24} color="$primary" />}
          </TamaguiButton>
        </Row>

        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <Column gap="$4">
            <Column gap="$2">
              <Text size="$3" color="$textSecondary" fontWeight="500">
                Label *
              </Text>
              <Input
                size="$5"
                value={formData.name}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
                placeholder="e.g. Home, Work, etc."
              />
            </Column>

            <Column gap="$2">
              <Text size="$3" color="$textSecondary" fontWeight="500">
                Street Address *
              </Text>
              <Input
                size="$5"
                value={formData.street1}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, street1: text }))}
                placeholder="House number and street"
              />
            </Column>

            <Column gap="$2">
              <Text size="$3" color="$textSecondary" fontWeight="500">
                Address Line 2
              </Text>
              <Input
                size="$5"
                value={formData.street2}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, street2: text }))}
                placeholder="Apartment, suite, unit, etc. (optional)"
              />
            </Column>

            <Row gap="$3">
              <Column gap="$2" flex={1}>
                <Text size="$3" color="$textSecondary" fontWeight="500">
                  City *
                </Text>
                <Input
                  size="$5"
                  value={formData.city}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, city: text }))}
                  placeholder="City"
                />
              </Column>

              <Column gap="$2" flex={1}>
                <Text size="$3" color="$textSecondary" fontWeight="500">
                  County/State
                </Text>
                <Input
                  size="$5"
                  value={formData.state}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, state: text }))}
                  placeholder="County"
                />
              </Column>
            </Row>

            <Row gap="$3">
              <Column gap="$2" flex={1}>
                <Text size="$3" color="$textSecondary" fontWeight="500">
                  Postal Code *
                </Text>
                <Input
                  size="$5"
                  value={formData.postalCode}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, postalCode: text }))}
                  placeholder="Postal code"
                  autoCapitalize="characters"
                />
              </Column>

              <Column gap="$2" flex={1}>
                <Text size="$3" color="$textSecondary" fontWeight="500">
                  Country
                </Text>
                <Input
                  size="$5"
                  value={formData.country}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, country: text }))}
                  placeholder="GB"
                  autoCapitalize="characters"
                />
              </Column>
            </Row>

            <Column gap="$2">
              <Text size="$3" color="$textSecondary" fontWeight="500">
                Phone Number
              </Text>
              <Input
                size="$5"
                value={formData.phone}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, phone: text }))}
                placeholder="For delivery updates (optional)"
                inputMode="tel"
              />
            </Column>

            <Row
              alignItems="center"
              justifyContent="space-between"
              backgroundColor="$surface"
              borderRadius="$lg"
              borderWidth={1}
              borderColor="$border"
              padding="$4"
            >
              <Column>
                <Text size="$4" fontWeight="500">
                  Set as Default
                </Text>
                <Text size="$3" color="$textSecondary">
                  Use this address by default
                </Text>
              </Column>
              <Switch
                checked={formData.isDefault}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isDefault: checked }))
                }
              />
            </Row>

            <Button
              butterVariant="primary"
              size="$5"
              width="100%"
              onPress={handleSave}
              disabled={saving}
              marginTop="$4"
            >
              {saving ? "Saving..." : viewMode === "add" ? "Add Address" : "Save Changes"}
            </Button>
          </Column>
        </ScrollView>
      </Column>
    );
  }

  // Render list view
  if (loading) {
    return (
      <Column
        flex={1}
        backgroundColor="$background"
        alignItems="center"
        justifyContent="center"
        paddingTop={insets.top}
      >
        <Spinner size="lg" color="$primary" />
        <Text color="$textSecondary" marginTop="$3">
          Loading addresses...
        </Text>
      </Column>
    );
  }

  return (
    <Column flex={1} backgroundColor="$background" paddingTop={insets.top}>
      {/* Header */}
      <Row
        paddingHorizontal="$4"
        paddingVertical="$3"
        alignItems="center"
        gap="$3"
        borderBottomWidth={1}
        borderBottomColor="$border"
      >
        <TamaguiButton
          chromeless
          circular
          size="$4"
          onPress={onBack}
          icon={<ArrowLeft size={24} color="$text" />}
        />
        <Heading level={4} flex={1}>
          Addresses
        </Heading>
        <TamaguiButton
          chromeless
          circular
          size="$4"
          onPress={handleAddNew}
          icon={<Plus size={24} color="$primary" />}
        />
      </Row>

      {error ? (
        <Column flex={1} alignItems="center" justifyContent="center" padding="$4">
          <Text color="$error" size="$5" textAlign="center" marginBottom="$4">
            {error}
          </Text>
          <Button butterVariant="primary" size="$4" onPress={() => void fetchAddresses()}>
            Try Again
          </Button>
        </Column>
      ) : addresses.length === 0 ? (
        <Column flex={1} alignItems="center" justifyContent="center" padding="$4">
          <MapPin size={64} color="$textMuted" />
          <Text size="$5" color="$textSecondary" marginTop="$4" textAlign="center">
            No addresses saved
          </Text>
          <Text size="$4" color="$textMuted" marginTop="$2" textAlign="center">
            Add a shipping address to checkout faster
          </Text>
          <Button butterVariant="primary" size="$4" marginTop="$4" onPress={handleAddNew}>
            Add Address
          </Button>
        </Column>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <Column gap="$3">
            {addresses.map((address) => (
              <Column
                key={address.id}
                backgroundColor="$surface"
                borderRadius="$lg"
                borderWidth={1}
                borderColor={address.isDefault ? "$primary" : "$border"}
                padding="$4"
                gap="$2"
              >
                <Row alignItems="center" justifyContent="space-between">
                  <Row alignItems="center" gap="$2">
                    <MapPin size={18} color={address.isDefault ? "$primary" : "$textSecondary"} />
                    <Text size="$4" fontWeight="600">
                      {address.name}
                    </Text>
                    {address.isDefault && (
                      <View
                        backgroundColor="$primary"
                        borderRadius="$full"
                        paddingHorizontal="$2"
                        paddingVertical="$1"
                      >
                        <Text size="$2" color="$textInverse" fontWeight="600">
                          Default
                        </Text>
                      </View>
                    )}
                  </Row>

                  <Row gap="$2">
                    <TamaguiButton
                      chromeless
                      size="$3"
                      onPress={() => handleEdit(address)}
                      icon={<Edit3 size={18} color="$text" />}
                    />
                    {!address.isDefault && (
                      <TamaguiButton
                        chromeless
                        size="$3"
                        onPress={() => handleDelete(address)}
                        icon={<Trash2 size={18} color="$error" />}
                      />
                    )}
                  </Row>
                </Row>

                <Column gap="$1">
                  <Text size="$3" color="$text">
                    {address.street1}
                  </Text>
                  {address.street2 && (
                    <Text size="$3" color="$text">
                      {address.street2}
                    </Text>
                  )}
                  <Text size="$3" color="$textSecondary">
                    {address.city}
                    {address.state && `, ${address.state}`} {address.postalCode}
                  </Text>
                  <Text size="$3" color="$textSecondary">
                    {address.country}
                  </Text>
                  {address.phone && (
                    <Text size="$3" color="$textMuted">
                      {address.phone}
                    </Text>
                  )}
                </Column>

                {!address.isDefault && (
                  <Button
                    size="$3"
                    chromeless
                    onPress={() => handleSetDefault(address)}
                    alignSelf="flex-start"
                  >
                    <Text size="$3" color="$primary">
                      Set as Default
                    </Text>
                  </Button>
                )}
              </Column>
            ))}
          </Column>
        </ScrollView>
      )}
    </Column>
  );
}
