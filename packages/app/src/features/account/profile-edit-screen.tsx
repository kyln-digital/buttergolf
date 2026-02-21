"use client";

import React, { useState, useCallback } from "react";
import { Column, Row, Text, Button, Heading, Spinner, Input } from "@buttergolf/ui";
import { Button as TamaguiButton, Avatar, View } from "tamagui";
import { ArrowLeft, Camera, Check } from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "react-native";

interface UserData {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  imageUrl?: string | null;
}

interface ImageData {
  uri: string;
  width?: number;
  height?: number;
}

export interface ProfileEditScreenProps {
  user: UserData | null;
  /** Update user profile via Clerk SDK */
  onUpdateProfile: (data: { firstName?: string; lastName?: string }) => Promise<void>;
  /** Pick an image from gallery */
  onPickImage?: () => Promise<ImageData | null>;
  /** Upload image and update profile */
  onUpdateProfileImage?: (image: ImageData) => Promise<string>;
  /** Navigate back */
  onBack: () => void;
}

/**
 * Profile edit screen for updating user name and profile image.
 * Uses Clerk SDK for profile updates (syncs to database via webhook).
 */
export function ProfileEditScreen({
  user,
  onUpdateProfile,
  onPickImage,
  onUpdateProfileImage,
  onBack,
}: Readonly<ProfileEditScreenProps>) {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const hasChanges =
    firstName !== (user?.firstName || "") ||
    lastName !== (user?.lastName || "") ||
    newImageUri !== null;

  // Generate initials for avatar fallback
  const getInitials = (): string => {
    const first = (firstName || user?.firstName)?.charAt(0)?.toUpperCase() || "";
    const last = (lastName || user?.lastName)?.charAt(0)?.toUpperCase() || "";
    return first + last || user?.email?.charAt(0)?.toUpperCase() || "?";
  };

  const handlePickImage = useCallback(async () => {
    if (!onPickImage) return;

    try {
      const image = await onPickImage();
      if (image) {
        setNewImageUri(image.uri);

        // Upload image immediately if handler provided
        if (onUpdateProfileImage) {
          setUploadingImage(true);
          try {
            await onUpdateProfileImage(image);
          } catch (err) {
            console.error("Failed to upload image:", err);
            Alert.alert("Error", "Failed to upload image. Please try again.");
            setNewImageUri(null);
          } finally {
            setUploadingImage(false);
          }
        }
      }
    } catch (err) {
      console.error("Failed to pick image:", err);
    }
  }, [onPickImage, onUpdateProfileImage]);

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;

    setSaving(true);
    try {
      await onUpdateProfile({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });

      Alert.alert("Success", "Your profile has been updated.", [{ text: "OK", onPress: onBack }]);
    } catch (err) {
      console.error("Failed to update profile:", err);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [firstName, lastName, hasChanges, onUpdateProfile, onBack]);

  const displayImageUri = newImageUri || user?.imageUrl;

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
          Edit Profile
        </Heading>
        <TamaguiButton
          chromeless
          size="$4"
          onPress={handleSave}
          disabled={!hasChanges || saving}
          opacity={!hasChanges || saving ? 0.5 : 1}
        >
          {saving ? (
            <Spinner size="sm" color="$primary" />
          ) : (
            <Check size={24} color={hasChanges ? "$primary" : "$textMuted"} />
          )}
        </TamaguiButton>
      </Row>

      <Column padding="$4" gap="$6">
        {/* Avatar Section */}
        <Column alignItems="center" gap="$3">
          <View position="relative">
            <Avatar circular size="$14">
              {displayImageUri ? (
                <Avatar.Image aria-label="Profile photo" src={displayImageUri} />
              ) : (
                <Avatar.Fallback
                  backgroundColor="$primary"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text size="$10" color="$textInverse" fontWeight="600">
                    {getInitials()}
                  </Text>
                </Avatar.Fallback>
              )}
            </Avatar>

            {onPickImage && (
              <TamaguiButton
                circular
                size="$4"
                backgroundColor="$primary"
                position="absolute"
                bottom={0}
                right={0}
                onPress={handlePickImage}
                disabled={uploadingImage}
                borderWidth={3}
                borderColor="$background"
              >
                {uploadingImage ? (
                  <Spinner size="sm" color="$textInverse" />
                ) : (
                  <Camera size={18} color="$white" />
                )}
              </TamaguiButton>
            )}
          </View>

          {onPickImage && (
            <Text size="$3" color="$textSecondary">
              Tap the camera to change your photo
            </Text>
          )}
        </Column>

        {/* Form Fields */}
        <Column gap="$4">
          <Column gap="$2">
            <Text size="$3" color="$textSecondary" fontWeight="500">
              First Name
            </Text>
            <Input
              size="$5"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Enter your first name"
              autoCapitalize="words"
              autoCorrect="off"
            />
          </Column>

          <Column gap="$2">
            <Text size="$3" color="$textSecondary" fontWeight="500">
              Last Name
            </Text>
            <Input
              size="$5"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Enter your last name"
              autoCapitalize="words"
              autoCorrect="off"
            />
          </Column>

          <Column gap="$2">
            <Text size="$3" color="$textSecondary" fontWeight="500">
              Email
            </Text>
            <Input
              size="$5"
              value={user?.email || ""}
              disabled
              backgroundColor="$gray100"
              color="$textSecondary"
            />
            <Text size="$2" color="$textMuted">
              Email cannot be changed here. Contact support if needed.
            </Text>
          </Column>
        </Column>

        {/* Save Button */}
        <Button
          butterVariant="primary"
          size="$5"
          width="100%"
          onPress={handleSave}
          disabled={!hasChanges || saving}
          marginTop="$4"
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </Column>
    </Column>
  );
}
