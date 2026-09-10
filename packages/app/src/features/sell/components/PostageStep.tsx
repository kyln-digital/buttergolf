"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Keyboard } from "react-native";
import { Column, Row, Text, View, Input, ScrollView } from "@buttergolf/ui";
import {
  PARCEL_PRESETS,
  getParcelPreset,
  getDefaultParcelPresetId,
  validateParcel,
} from "@buttergolf/constants";
import { Package, Ruler, Weight, Check, AlertTriangle } from "@tamagui/lucide-icons";

import type { SellFormData } from "../types";
import { resolveFormParcel } from "../types";

interface PostageStepProps {
  formData: SellFormData;
  onUpdate: (updates: Partial<SellFormData>) => void;
  direction: "forward" | "backward";
}

function DimensionInput({
  label,
  unit,
  value,
  placeholder,
  onChangeText,
}: Readonly<{
  label: string;
  unit: string;
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
}>) {
  const [focused, setFocused] = useState(false);

  return (
    <Column gap="$xs" flex={1}>
      <Text size="$3" fontWeight="600" color="$textSecondary">
        {label}
      </Text>
      <Row
        backgroundColor="$pureWhite"
        borderWidth={2}
        borderColor={focused ? "$spicedClementine" : "$cloudMist"}
        borderRadius="$lg"
        paddingHorizontal="$sm"
        alignItems="center"
        gap="$xs"
      >
        <Input
          flex={1}
          value={value}
          onChangeText={(text: string) => onChangeText(text.replaceAll(/[^0-9.]/g, ""))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor="$textMuted"
          keyboardType="decimal-pad"
          borderWidth={0}
          backgroundColor="transparent"
          size="$5"
          color="$text"
        />
        <Text size="$3" color="$textMuted">
          {unit}
        </Text>
      </Row>
    </Column>
  );
}

export function PostageStep({ formData, onUpdate, direction }: Readonly<PostageStepProps>) {
  const { parcelPresetId, categorySlug } = formData;

  // Preselect from the category once, so a seller listing a driver isn't
  // scrolling past golf bags to find the right box.
  useEffect(() => {
    if (!parcelPresetId && categorySlug) {
      onUpdate({ parcelPresetId: getDefaultParcelPresetId(categorySlug) });
    }
  }, [parcelPresetId, categorySlug, onUpdate]);

  const selectedPreset = getParcelPreset(parcelPresetId);
  const resolved = useMemo(() => resolveFormParcel(formData), [formData]);
  const errors = useMemo(
    () => (selectedPreset ? validateParcel(resolved) : []),
    [selectedPreset, resolved]
  );

  const hasOverrides = Boolean(
    formData.parcelLength || formData.parcelWidth || formData.parcelHeight || formData.parcelWeight
  );

  return (
    <Column
      flex={1}
      animation="quick"
      enterStyle={{ opacity: 0, x: direction === "forward" ? 50 : -50 }}
      exitStyle={{ opacity: 0, x: direction === "forward" ? -50 : 50 }}
    >
      <ScrollView
        flex={1}
        contentContainerStyle={{ padding: 20 }}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
      >
        <Column gap="$sm" marginBottom="$xl">
          <Text fontFamily="$heading" size="$10" fontWeight="800" color="$text">
            How will you post it?
          </Text>
          <Text size="$5" fontWeight="400" color="$textSecondary">
            Pick the closest match. We use this to quote the buyer and to buy the shipping label, so
            it needs to be the packed box — not the item on its own.
          </Text>
        </Column>

        <Column gap="$sm" marginBottom="$xl">
          {PARCEL_PRESETS.map((preset) => {
            const isSelected = preset.id === parcelPresetId;
            return (
              <Row
                key={preset.id}
                onPress={() => onUpdate({ parcelPresetId: preset.id })}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${preset.label}. ${preset.hint}`}
                cursor="pointer"
                backgroundColor={isSelected ? "$vanillaCream" : "$pureWhite"}
                borderWidth={2}
                borderColor={isSelected ? "$spicedClementine" : "$cloudMist"}
                borderRadius="$xl"
                padding="$md"
                gap="$md"
                alignItems="center"
                pressStyle={{ opacity: 0.85 }}
              >
                <Package size={20} color={isSelected ? "$spicedClementine" : "$textSecondary"} />
                <Column flex={1} gap="$xs">
                  <Text size="$5" fontWeight="600" color="$text">
                    {preset.label}
                  </Text>
                  <Text size="$3" color="$textSecondary">
                    {preset.hint} · {preset.length}×{preset.width}×{preset.height}cm ·{" "}
                    {preset.weight >= 1000
                      ? `${(preset.weight / 1000).toFixed(1)}kg`
                      : `${preset.weight}g`}
                  </Text>
                </Column>
                {isSelected && <Check size={20} color="$spicedClementine" />}
              </Row>
            );
          })}
        </Column>

        {/* Overrides. Optional — the preset already gives us usable numbers. */}
        <Column gap="$md" marginBottom="$lg">
          <Row alignItems="center" gap="$sm">
            <Ruler size={16} color="$textSecondary" />
            <Text size="$4" fontWeight="600" color="$text">
              Know the exact size? (optional)
            </Text>
          </Row>
          <Text size="$3" color="$textSecondary">
            Leave blank to use the preset above. Accurate numbers mean a more accurate quote and
            fewer carrier surcharges.
          </Text>
          <Row gap="$sm">
            <DimensionInput
              label="Length"
              unit="cm"
              value={formData.parcelLength}
              placeholder={String(selectedPreset?.length ?? "")}
              onChangeText={(text) => onUpdate({ parcelLength: text })}
            />
            <DimensionInput
              label="Width"
              unit="cm"
              value={formData.parcelWidth}
              placeholder={String(selectedPreset?.width ?? "")}
              onChangeText={(text) => onUpdate({ parcelWidth: text })}
            />
            <DimensionInput
              label="Height"
              unit="cm"
              value={formData.parcelHeight}
              placeholder={String(selectedPreset?.height ?? "")}
              onChangeText={(text) => onUpdate({ parcelHeight: text })}
            />
          </Row>
          <Row alignItems="center" gap="$sm">
            <Weight size={16} color="$textSecondary" />
            <View flex={1}>
              <DimensionInput
                label="Packed weight"
                unit="g"
                value={formData.parcelWeight}
                placeholder={String(selectedPreset?.weight ?? "")}
                onChangeText={(text) => onUpdate({ parcelWeight: text })}
              />
            </View>
          </Row>
        </Column>

        {errors.length > 0 && (
          <Column
            gap="$xs"
            backgroundColor="$errorLight"
            borderRadius="$lg"
            padding="$md"
            marginBottom="$md"
          >
            {errors.map((error) => (
              <Row key={`${error.field}-${error.message}`} gap="$sm" alignItems="center">
                <AlertTriangle size={16} color="$error" />
                <Text size="$3" color="$error" flex={1}>
                  {error.message}
                </Text>
              </Row>
            ))}
          </Column>
        )}

        {errors.length === 0 && selectedPreset && (
          <Row
            gap="$sm"
            alignItems="center"
            backgroundColor="$lemonHaze"
            borderRadius="$lg"
            paddingHorizontal="$md"
            paddingVertical="$sm"
          >
            <Package size={16} color="$burntOlive" />
            <Text size="$3" fontWeight="500" color="$burntOlive" flex={1}>
              Posting as {resolved.length}×{resolved.width}×{resolved.height}cm,{" "}
              {resolved.weight >= 1000
                ? `${(resolved.weight / 1000).toFixed(1)}kg`
                : `${resolved.weight}g`}
              {hasOverrides ? " (your measurements)" : ""}
            </Text>
          </Row>
        )}
      </ScrollView>
    </Column>
  );
}
