"use client";

import { Column, Container, Heading, Text } from "@buttergolf/ui";

export function PrivacyPolicyClient() {
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
            <Heading level={1}>Privacy Policy</Heading>
            <Text color="$textSecondary" textAlign="center">
              Last updated: January 5, 2026
            </Text>
          </Column>

          {/* Content */}
          <Column gap="$xl">
            <Column gap="$md">
              <Text size="$6">
                At ButterGolf, we are committed to protecting your privacy and
                ensuring the security of your personal information. This Privacy
                Policy explains how we collect, use, disclose, and safeguard your
                data when you use our marketplace platform.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>1. Information We Collect</Heading>
              <Column gap="$sm">
                <Text fontWeight="600">1.1 Information You Provide</Text>
                <Text>
                  When you create an account, list items, or make purchases, we
                  collect information such as your name, email address, payment
                  information, shipping address, and any other details you
                  provide. We also collect information from your communications
                  with us and other users through our messaging system.
                </Text>
              </Column>
              <Column gap="$sm">
                <Text fontWeight="600">1.2 Automatically Collected Information</Text>
                <Text>
                  We automatically collect certain information when you visit our
                  platform, including your IP address, browser type, device
                  information, pages viewed, and usage patterns. We use cookies
                  and similar technologies to collect this data.
                </Text>
              </Column>
            </Column>

            <Column gap="$md">
              <Heading level={2}>2. How We Use Your Information</Heading>
              <Text>We use the information we collect to:</Text>
              <Column gap="$sm" paddingLeft="$lg">
                <Text>
                  • Facilitate transactions between buyers and sellers
                </Text>
                <Text>
                  • Process payments and prevent fraud
                </Text>
                <Text>
                  • Communicate with you about your account and transactions
                </Text>
                <Text>
                  • Improve and personalise your experience on our platform
                </Text>
                <Text>
                  • Send marketing communications (with your consent)
                </Text>
                <Text>
                  • Comply with legal obligations and enforce our terms
                </Text>
                <Text>
                  • Analyse usage patterns to improve our services
                </Text>
              </Column>
            </Column>

            <Column gap="$md">
              <Heading level={2}>3. Information Sharing and Disclosure</Heading>
              <Column gap="$sm">
                <Text fontWeight="600">3.1 With Other Users</Text>
                <Text>
                  When you list items or make purchases, certain information
                  (such as your username and ratings) is visible to other users
                  to facilitate transactions.
                </Text>
              </Column>
              <Column gap="$sm">
                <Text fontWeight="600">3.2 With Service Providers</Text>
                <Text>
                  We share information with third-party service providers who
                  help us operate our platform, including payment processors,
                  hosting providers, and analytics services. These providers are
                  contractually obligated to protect your information.
                </Text>
              </Column>
              <Column gap="$sm">
                <Text fontWeight="600">3.3 Legal Requirements</Text>
                <Text>
                  We may disclose your information when required by law, to
                  protect our rights, or to comply with legal processes.
                </Text>
              </Column>
            </Column>

            <Column gap="$md">
              <Heading level={2}>4. Cookies and Tracking Technologies</Heading>
              <Text>
                We use cookies, web beacons, and similar technologies to track
                user activity and enhance your experience. You can control cookie
                preferences through your browser settings, though some features
                may not function properly if cookies are disabled.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>5. Data Security</Heading>
              <Text>
                We implement industry-standard security measures to protect your
                information from unauthorised access, alteration, disclosure, or
                destruction. However, no method of transmission over the internet
                is 100% secure, and we cannot guarantee absolute security.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>6. Data Retention</Heading>
              <Text>
                We retain your personal information for as long as necessary to
                provide our services, comply with legal obligations, resolve
                disputes, and enforce our agreements. You may request deletion of
                your account and associated data at any time.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>7. Your Rights and Choices</Heading>
              <Text>Depending on your location, you may have the right to:</Text>
              <Column gap="$sm" paddingLeft="$lg">
                <Text>
                  • Access, correct, or delete your personal information
                </Text>
                <Text>
                  • Object to or restrict certain processing of your data
                </Text>
                <Text>
                  • Opt out of marketing communications
                </Text>
                <Text>
                  • Request data portability
                </Text>
                <Text>
                  • Withdraw consent where processing is based on consent
                </Text>
              </Column>
              <Text>
                To exercise these rights, contact us at privacy@buttergolf.com.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>8. Children&apos;s Privacy</Heading>
              <Text>
                ButterGolf is not intended for users under the age of 18. We do
                not knowingly collect personal information from children. If we
                learn that we have collected information from a child, we will
                take steps to delete it promptly.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>9. International Data Transfers</Heading>
              <Text>
                Your information may be transferred to and processed in countries
                other than your own. These countries may have different data
                protection laws, but we ensure appropriate safeguards are in
                place to protect your information.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>10. Third-Party Links</Heading>
              <Text>
                Our platform may contain links to third-party websites. We are
                not responsible for the privacy practices of these websites. We
                encourage you to review their privacy policies before providing
                any personal information.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>11. GDPR Compliance (EU Users)</Heading>
              <Text>
                If you are in the European Economic Area, you have additional
                rights under the General Data Protection Regulation (GDPR),
                including the right to lodge a complaint with a supervisory
                authority. We process your data based on legitimate interests,
                contractual necessity, or your consent.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>12. CCPA Rights (California Users)</Heading>
              <Text>
                California residents have the right to know what personal
                information we collect, request deletion of their information,
                and opt out of the sale of their information. ButterGolf does not
                sell personal information.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>13. Changes to This Policy</Heading>
              <Text>
                We may update this Privacy Policy from time to time. We will
                notify you of material changes by posting the updated policy on
                our platform and updating the &quot;Last updated&quot; date. Continued use
                of ButterGolf after changes are posted constitutes acceptance of
                the updated policy.
              </Text>
            </Column>

            <Column gap="$md">
              <Heading level={2}>14. Contact Us</Heading>
              <Text>
                If you have questions or concerns about this Privacy Policy or
                our data practices, please contact us at:
              </Text>
              <Column gap="$xs" paddingLeft="$lg">
                <Text>Email: privacy@buttergolf.com</Text>
                <Text>Data Protection Officer: dpo@buttergolf.com</Text>
                <Text>Live Chat: Available 9am-6pm GMT Monday-Friday</Text>
              </Column>
            </Column>
          </Column>
        </Column>
      </Container>
    </Column>
  );
}
