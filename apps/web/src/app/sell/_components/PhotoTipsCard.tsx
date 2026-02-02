import { Column, Row, Text, Card } from "@buttergolf/ui";

/**
 * PhotoTipsCard - Displays helpful photography tips for sellers
 * Shows 3 key tips for taking quality product photos
 */
export function PhotoTipsCard() {
  return (
    <Card variant="filled" padding="$md" backgroundColor="$infoLight" borderRadius="$lg">
      <Column gap="$md">
        {/* Card Title */}
        <Text size="$5" fontWeight="600" color="$text">
          Tips for good photos
        </Text>

        {/* Tips List */}
        <Column gap="$md">
          {/* Tip 1 */}
          <Row gap="$sm" alignItems="flex-start">
            <Row
              width={32}
              height={32}
              minWidth={32}
              minHeight={32}
              backgroundColor="$text"
              borderRadius="$full"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Text size="$4" color="$textInverse" fontWeight="700">
                1
              </Text>
            </Row>
            <Column gap="$xs" flex={1}>
              <Text size="$4" fontWeight="600" color="$text">
                Set Up a Clean Background
              </Text>
              <Text size="$3" color="$textSecondary" lineHeight={18}>
                A simple background helps buyers focus on the product. Avoid busy patterns or
                colours. Make sure the surface is clean and flat.
              </Text>
            </Column>
          </Row>

          {/* Tip 2 */}
          <Row gap="$sm" alignItems="flex-start">
            <Row
              width={32}
              height={32}
              minWidth={32}
              minHeight={32}
              backgroundColor="$text"
              borderRadius="$full"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Text size="$4" color="$textInverse" fontWeight="700">
                2
              </Text>
            </Row>
            <Column gap="$xs" flex={1}>
              <Text size="$4" fontWeight="600" color="$text">
                Use Bright, Even Lighting
              </Text>
              <Text size="$3" color="$textSecondary" lineHeight={18}>
                Avoid harsh shadows. Use two lamps on either side if natural light is low. Never mix
                warm and cool light. Choose one tone.
              </Text>
            </Column>
          </Row>

          {/* Tip 3 */}
          <Row gap="$sm" alignItems="flex-start">
            <Row
              width={32}
              height={32}
              minWidth={32}
              minHeight={32}
              backgroundColor="$text"
              borderRadius="$full"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Text size="$4" color="$textInverse" fontWeight="700">
                3
              </Text>
            </Row>
            <Column gap="$xs" flex={1}>
              <Text size="$4" fontWeight="600" color="$text">
                Capture the Essential Angles
              </Text>
              <Text size="$3" color="$textSecondary" lineHeight={18}>
                Make sure every item is photographed clearly from all essential angles. Keep the
                frame clean and uncluttered, with the product centred and fully visible. Consistent,
                well-lit angles help buyers trust what they&apos;re seeing.
              </Text>
            </Column>
          </Row>
        </Column>
      </Column>
    </Card>
  );
}
