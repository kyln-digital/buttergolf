"use client";

import { Column, Container, Heading, Text } from "@buttergolf/ui";

export function TermsOfServiceClient() {
  return (
    <Column
      backgroundColor="$background"
      minHeight="100vh"
      alignItems="center"
      width="100%"
    >
      <Container size="lg" paddingVertical="$10">
        <Column gap="$2xl">
          {/* Header */}
          <Column gap="$md" alignItems="center">
            <Heading level={1}>Terms of Service</Heading>
            <Text color="$textSecondary" textAlign="center">
              Last updated: January 5, 2026
            </Text>
          </Column>

          {/* Content */}
          <Column gap="$xl">
            <Column gap="$md">
              <Text size="$6">
                Welcome to ButterGolf. By accessing and using our marketplace
                platform, you agree to be bound by these Terms of Service.
                Please read them carefully.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>1. Acceptance of Terms</Heading>
              <Text>
                By creating an account, listing items for sale, purchasing
                items, or otherwise using ButterGolf, you agree to comply with
                and be legally bound by these Terms of Service. If you do not
                agree to these terms, please do not use our services.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>2. Eligibility</Heading>
              <Text>
                You must be at least 18 years old to use ButterGolf. By using
                our platform, you represent and warrant that you are of legal
                age to form a binding contract and are not prohibited from
                accessing or using our services under applicable law.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>3. User Accounts</Heading>
              <Text>
                You are responsible for maintaining the confidentiality of your
                account credentials and for all activities that occur under your
                account. You agree to immediately notify us of any unauthorised
                use of your account. ButterGolf reserves the right to suspend or
                terminate accounts that violate these terms.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>4. Marketplace Transactions</Heading>
              <Column gap="$sm">
                <Text fontWeight="600">4.1 Seller Responsibilities</Text>
                <Text>
                  Sellers are responsible for accurately describing their items,
                  setting fair prices, and fulfilling orders in a timely manner.
                  All golf equipment must be genuine and in the condition
                  described. Misrepresentation of items may result in account
                  suspension.
                </Text>
              </Column>
              <Column gap="$sm">
                <Text fontWeight="600">4.2 Buyer Responsibilities</Text>
                <Text>
                  Buyers agree to pay for items they purchase and to communicate
                  respectfully with sellers. Disputes should be resolved through
                  our messaging system or with the assistance of ButterGolf
                  support.
                </Text>
              </Column>
              <Column gap="$sm">
                <Text fontWeight="600">4.3 Platform Fees</Text>
                <Text>
                  ButterGolf charges a service fee on completed transactions.
                  The current fee structure is displayed during the listing
                  process. We reserve the right to modify fees with reasonable
                  notice.
                </Text>
              </Column>
            </Column>

            <Column gap="$md">
              <Heading level={2}>5. Payment and Refunds</Heading>
              <Text>
                All payments are processed securely through our payment
                provider. Refunds are handled according to our Refund Policy and
                are subject to the condition of returned items. ButterGolf is
                not liable for disputes between buyers and sellers but will
                provide reasonable assistance in resolving issues.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>6. Prohibited Activities</Heading>
              <Text>You agree not to:</Text>
              <Column gap="$sm" paddingLeft="$lg">
                <Text>
                  • List counterfeit, stolen, or illegal items
                </Text>
                <Text>
                  • Engage in fraudulent transactions or payment schemes
                </Text>
                <Text>
                  • Harass, threaten, or abuse other users
                </Text>
                <Text>
                  • Attempt to circumvent platform fees or payment systems
                </Text>
                <Text>
                  • Use automated systems to scrape or manipulate the platform
                </Text>
                <Text>
                  • Violate any applicable laws or regulations
                </Text>
              </Column>
            </Column>

            <Column gap="$md">
              <Heading level={2}>7. Intellectual Property</Heading>
              <Text>
                All content on ButterGolf, including logos, designs, text,
                graphics, and software, is the property of ButterGolf or its
                licensors and is protected by copyright and trademark laws. You
                may not use, reproduce, or distribute our content without
                written permission.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>8. User Content</Heading>
              <Text>
                By posting content on ButterGolf (including product listings,
                reviews, and messages), you grant us a non-exclusive,
                royalty-free, worldwide licence to use, display, and distribute
                that content in connection with operating our platform. You
                represent that you own or have the necessary rights to any
                content you post.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>9. Disclaimers and Limitations</Heading>
              <Text>
                ButterGolf is a marketplace platform that connects buyers and
                sellers. We are not a party to transactions between users and do
                not guarantee the quality, safety, or legality of items listed.
                THE PLATFORM IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND.
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, BUTTERGOLF SHALL NOT BE
                LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>10. Indemnification</Heading>
              <Text>
                You agree to indemnify and hold harmless ButterGolf, its
                officers, directors, employees, and agents from any claims,
                losses, damages, liabilities, and expenses arising from your use
                of the platform, your violation of these terms, or your
                infringement of any rights of another party.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>11. Termination</Heading>
              <Text>
                We reserve the right to suspend or terminate your account at any
                time for violation of these Terms of Service or for any other
                reason at our sole discretion. Upon termination, your right to
                use the platform will immediately cease.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>12. Dispute Resolution</Heading>
              <Text>
                Any disputes arising from these Terms of Service or your use of
                ButterGolf shall be resolved through binding arbitration in
                accordance with the rules of the applicable arbitration
                association. You waive your right to participate in class action
                lawsuits.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>13. Changes to Terms</Heading>
              <Text>
                We may update these Terms of Service from time to time. Continued
                use of the platform after changes are posted constitutes
                acceptance of the modified terms. We will notify users of
                material changes via email or platform notification.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>14. Governing Law</Heading>
              <Text>
                These Terms of Service shall be governed by and construed in
                accordance with the laws of the jurisdiction in which ButterGolf
                operates, without regard to conflict of law principles.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>15. Contact Information</Heading>
              <Text>
                If you have questions about these Terms of Service, please
                contact us at:
              </Text>
              <Column gap="$xs" paddingLeft="$lg">
                <Text>Email: legal@buttergolf.com</Text>
                <Text>Live Chat: Available 9am-6pm GMT Monday-Friday</Text>
              </Column>
            </Column>
          </Column>
        </Column>
      </Container>
    </Column>
  );
}
