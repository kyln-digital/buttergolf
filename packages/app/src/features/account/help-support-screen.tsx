"use client";

import React, { useState } from "react";
import {
  Column,
  Row,
  Text,
  Button,
  Button as TamaguiButton,
  Heading,
  ScrollView,
  View,
} from "@buttergolf/ui";
import { Accordion, Square, Paragraph } from "tamagui";
import {
  ArrowLeft,
  HelpCircle,
  Mail,
  MessageCircle,
  ChevronDown,
  ExternalLink,
  Shield,
  Package,
  CreditCard,
  RefreshCw,
} from "@tamagui/lucide-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Linking } from "react-native";

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: "How does buyer protection work?",
    answer:
      "When you purchase an item, your payment is held securely until you confirm you've received the item in the expected condition. You have 14 days after delivery to confirm receipt. If there's an issue, contact us and we'll help resolve it.",
  },
  {
    question: "How do I track my order?",
    answer:
      "Go to My Orders in your account to see all your purchases. Tap on an order to view tracking information, including carrier details and delivery estimates.",
  },
  {
    question: "How do I become a seller?",
    answer:
      "Tap 'Start Selling' in your account settings to begin the seller onboarding process. You'll need to verify your identity and connect a bank account to receive payments.",
  },
  {
    question: "When do sellers receive payment?",
    answer:
      "Sellers receive payment after the buyer confirms receipt, or automatically 14 days after delivery if the buyer doesn't confirm. Payments are transferred to your connected bank account within 2-3 business days.",
  },
  {
    question: "How do I return an item?",
    answer:
      "If an item doesn't match its description, contact the seller through the order messages. If you can't resolve it with the seller, reach out to our support team before confirming receipt.",
  },
  {
    question: "What payment methods are accepted?",
    answer:
      "We accept all major credit and debit cards, Apple Pay, and Google Pay. All payment processing is handled securely through Stripe.",
  },
  {
    question: "How do I delete my account?",
    answer:
      "To delete your account, please contact our support team. Note that you cannot delete your account if you have pending orders or unresolved transactions.",
  },
];

export interface HelpSupportScreenProps {
  /** Support email address */
  supportEmail?: string;
  /** Open live chat (if available) */
  onOpenChat?: () => void;
  /** Navigate back */
  onBack: () => void;
}

export function HelpSupportScreen({
  supportEmail = "support@buttergolf.com",
  onOpenChat,
  onBack,
}: Readonly<HelpSupportScreenProps>) {
  const insets = useSafeAreaInsets();
  const [expandedFaq, setExpandedFaq] = useState<string | undefined>(undefined);

  const handleEmailSupport = () => {
    void Linking.openURL(`mailto:${supportEmail}?subject=ButterGolf Support Request`);
  };

  const handleOpenWebsite = () => {
    void Linking.openURL("https://buttergolf.com/help");
  };

  // Get icon for FAQ item based on content
  const getFaqIcon = (question: string) => {
    if (question.includes("protection")) return <Shield size={20} color="$success" />;
    if (question.includes("track") || question.includes("order"))
      return <Package size={20} color="$primary" />;
    if (question.includes("payment")) return <CreditCard size={20} color="$warning" />;
    if (question.includes("return")) return <RefreshCw size={20} color="$secondary" />;
    return <HelpCircle size={20} color="$textSecondary" />;
  };

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
          Help & Support
        </Heading>
      </Row>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 16,
        }}
      >
        {/* Contact Options */}
        <Column gap="$3" marginBottom="$6">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2" marginBottom="$1">
            CONTACT US
          </Text>

          <TamaguiButton
            unstyled
            backgroundColor="$surface"
            borderRadius="$lg"
            borderWidth={1}
            borderColor="$border"
            padding="$4"
            pressStyle={{ backgroundColor: "$backgroundPress", scale: 0.98 }}
            onPress={handleEmailSupport}
          >
            <Row alignItems="center" gap="$3">
              <View
                width={44}
                height={44}
                borderRadius="$full"
                backgroundColor="$primaryLight"
                alignItems="center"
                justifyContent="center"
              >
                <Mail size={22} color="$primary" />
              </View>
              <Column flex={1}>
                <Text size="$4" fontWeight="500">
                  Email Support
                </Text>
                <Text size="$3" color="$textSecondary">
                  {supportEmail}
                </Text>
              </Column>
              <ExternalLink size={18} color="$textMuted" />
            </Row>
          </TamaguiButton>

          {onOpenChat && (
            <TamaguiButton
              unstyled
              backgroundColor="$surface"
              borderRadius="$lg"
              borderWidth={1}
              borderColor="$border"
              padding="$4"
              pressStyle={{ backgroundColor: "$backgroundPress", scale: 0.98 }}
              onPress={onOpenChat}
            >
              <Row alignItems="center" gap="$3">
                <View
                  width={44}
                  height={44}
                  borderRadius="$full"
                  backgroundColor="$secondaryLight"
                  alignItems="center"
                  justifyContent="center"
                >
                  <MessageCircle size={22} color="$secondary" />
                </View>
                <Column flex={1}>
                  <Text size="$4" fontWeight="500">
                    Live Chat
                  </Text>
                  <Text size="$3" color="$textSecondary">
                    Talk to our team
                  </Text>
                </Column>
                <ExternalLink size={18} color="$textMuted" />
              </Row>
            </TamaguiButton>
          )}
        </Column>

        {/* FAQ Section */}
        <Column gap="$3" marginBottom="$6">
          <Text size="$3" color="$textSecondary" fontWeight="600" marginLeft="$2" marginBottom="$1">
            FREQUENTLY ASKED QUESTIONS
          </Text>

          <Accordion type="single" collapsible value={expandedFaq} onValueChange={setExpandedFaq}>
            {faqItems.map((item, index) => (
              <Accordion.Item key={index} value={`faq-${index}`}>
                <Accordion.Trigger
                  unstyled
                  backgroundColor="$surface"
                  borderRadius="$lg"
                  borderWidth={1}
                  borderColor="$border"
                  padding="$4"
                  marginBottom="$2"
                  flexDirection="row"
                  alignItems="center"
                  gap="$3"
                >
                  {({ open }: { open?: boolean }) => (
                    <>
                      {getFaqIcon(item.question)}
                      <Text size="$4" fontWeight="500" flex={1}>
                        {item.question}
                      </Text>
                      <Square transition="medium" rotate={open ? "180deg" : "0deg"}>
                        <ChevronDown size={20} color="$textMuted" />
                      </Square>
                    </>
                  )}
                </Accordion.Trigger>
                <Accordion.HeightAnimator transition="medium">
                  <Accordion.Content
                    transition="medium"
                    backgroundColor="$gray100"
                    borderRadius="$lg"
                    padding="$4"
                    marginBottom="$2"
                    marginTop={-8}
                  >
                    <Paragraph size="$3" color="$text" lineHeight="$4">
                      {item.answer}
                    </Paragraph>
                  </Accordion.Content>
                </Accordion.HeightAnimator>
              </Accordion.Item>
            ))}
          </Accordion>
        </Column>

        {/* Help Center Link */}
        <Column
          backgroundColor="$surface"
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$border"
          padding="$4"
          alignItems="center"
          gap="$2"
        >
          <HelpCircle size={32} color="$primary" />
          <Text size="$4" fontWeight="600" textAlign="center">
            Need more help?
          </Text>
          <Text size="$3" color="$textSecondary" textAlign="center">
            Visit our Help Center for more articles and guides
          </Text>
          <Button
            size="$4"
            backgroundColor="$surface"
            borderWidth={1}
            borderColor="$primary"
            onPress={handleOpenWebsite}
            marginTop="$2"
          >
            <Text color="$primary" fontWeight="500">
              Visit Help Center
            </Text>
          </Button>
        </Column>

        {/* App Version */}
        <Text size="$2" color="$textMuted" textAlign="center" marginTop="$6">
          ButterGolf v1.0.0 • Build 1
        </Text>
      </ScrollView>
    </Column>
  );
}
