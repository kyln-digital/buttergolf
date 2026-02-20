"use client";

import Link from "next/link";
import Image from "next/image";
import { Column, Row, Text, Heading, Card } from "@buttergolf/ui";
import { imagePaths } from "@buttergolf/assets";

interface Category {
  id: string;
  name: string;
  label: string;
  image: string;
  link: string;
}

const categories: Category[] = [
  {
    id: "woods",
    name: "Woods",
    label: "WOODS ON SALE",
    image: imagePaths.clubs.club1,
    link: "/category/woods",
  },
  {
    id: "irons",
    name: "Irons",
    label: "IRONS ON SALE",
    image: imagePaths.clubs.club2,
    link: "/category/irons",
  },
  {
    id: "bags",
    name: "Bags",
    label: "BAGS ON SALE",
    image: imagePaths.clubs.club3,
    link: "/category/bags",
  },
  {
    id: "accessories",
    name: "Accessories",
    label: "ACCESSORIES ON SALE",
    image: imagePaths.clubs.club4,
    link: "/category/accessories",
  },
];

export function CategoryGrid() {
  return (
    <Column
      width="100%"
      paddingVertical="$8"
      $md={{ paddingVertical: "$12" }}
      $lg={{ paddingVertical: "$16" }}
      backgroundColor="$surface"
    >
      {/* Section Title */}
      <Column
        width="100%"
        maxWidth={1440}
        marginHorizontal="auto"
        paddingHorizontal="$4"
        $md={{ paddingHorizontal: "$6" }}
        $lg={{ paddingHorizontal: "$8" }}
        gap="$8"
      >
        <Heading
          level={2}
          color="$primary"
          textAlign="center"
          letterSpacing={2}
          textTransform="uppercase"
          size="$10"
          $md={{ size: "$11" }}
        >
          SHOP BY CATEGORY
        </Heading>

        {/* Category Grid */}
        <Row flexWrap="wrap" gap="$lg" width="100%" $sm={{ gap: "$lg" }}>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={category.link}
              style={{
                textDecoration: "none",
                width: "100%",
              }}
              className="category-link"
            >
              <Card
                variant="outlined"
                width="100%"
                aspectRatio={1}
                backgroundColor="$surface"
                borderWidth={3}
                borderColor="$primary"
                borderRadius="$xs"
                overflow="hidden"
                cursor="pointer"
                animation="medium"
                shadowColor="$shadowColor"
                shadowOffset={{ width: 0, height: 14 }}
                shadowRadius={28}
                shadowOpacity={0.4}
                hoverStyle={{
                  y: -4,
                  shadowOffset: { width: 0, height: 8 },
                  shadowRadius: 16,
                  shadowColor: "$primaryHover",
                  shadowOpacity: 0.2,
                }}
                pressStyle={{
                  y: -2,
                }}
              >
                {/* Image Container */}
                <Column
                  flex={1}
                  padding="$lg"
                  alignItems="center"
                  justifyContent="center"
                  overflow="hidden"
                  position="relative"
                >
                  <Image
                    src={category.image}
                    alt={category.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    style={{
                      objectFit: "contain",
                    }}
                    className="category-image"
                  />
                </Column>

                {/* Label at Bottom */}
                <Row
                  backgroundColor="$primary"
                  padding="$lg"
                  justifyContent="center"
                  alignItems="center"
                >
                  <Text
                    weight="bold"
                    color="$textInverse"
                    size="$6"
                    letterSpacing={1.5}
                    textTransform="uppercase"
                    textAlign="center"
                  >
                    {category.label}
                  </Text>
                </Row>
              </Card>
            </Link>
          ))}
        </Row>
      </Column>

      {/* Responsive layout and hover effects */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .category-link {
            width: 100%;
          }

          @media (min-width: 768px) {
            .category-link {
              width: calc(50% - 12px);
            }
          }

          @media (min-width: 1024px) {
            .category-link {
              width: calc(25% - 18px);
            }
          }

          .category-image {
            transition: transform 0.3s ease;
          }

          .category-link:hover .category-image {
            transform: scale(1.05);
          }
        `,
        }}
      />
    </Column>
  );
}
