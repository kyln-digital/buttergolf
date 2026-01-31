"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Row, Column, Text, Theme } from "@buttergolf/ui";
import type { MenuItem } from "./menuData";
import { ChevronDownIcon } from "./icons";

interface DesktopMenuProps {
  menuData: MenuItem[];
  stickyMenu?: boolean;
}

export function DesktopMenu({ menuData }: Readonly<DesktopMenuProps>) {
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const pathname = usePathname();

  return (
    <Row tag="nav" gap="$6" alignItems="center" flexWrap="wrap" justifyContent="center">
      {menuData.map((menuItem) => {
        const hasSubmenu = Boolean(menuItem.submenu);
        const isActive = menuItem.path && pathname.split("?")[0] === menuItem.path.split("?")[0];
        const menuIndex = menuData.indexOf(menuItem);

        return (
          <Column
            key={menuItem.title}
            position="relative"
            onMouseEnter={() => setActiveDropdown(menuIndex)}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            {hasSubmenu ? (
              <>
                <Theme name={isActive ? "active" : null}>
                  <Row
                    tag="button"
                    alignItems="center"
                    gap="$xs"
                    cursor="pointer"
                    paddingVertical="$2"
                    paddingHorizontal="$3"
                    borderRadius="$md"
                    backgroundColor="transparent"
                    borderWidth={0}
                    hoverStyle={{ backgroundColor: "$backgroundHover" }}
                  >
                    <Text size="$3" weight="medium" whiteSpace="nowrap">
                      {menuItem.title}
                    </Text>
                    <Column
                      transform={activeDropdown === menuIndex ? [{ rotate: "180deg" }] : undefined}
                      animation="quick"
                    >
                      <ChevronDownIcon />
                    </Column>
                  </Row>
                </Theme>

                <Column
                  position="absolute"
                  left={0}
                  top="100%"
                  marginTop="$2"
                  backgroundColor="$background"
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$md"
                  padding="$2"
                  minWidth={220}
                  zIndex={50}
                  opacity={activeDropdown === menuIndex ? 1 : 0}
                  y={activeDropdown === menuIndex ? 0 : 8}
                  pointerEvents={activeDropdown === menuIndex ? "auto" : "none"}
                  animation="quick"
                  shadowColor="$shadowColor"
                  shadowRadius={16}
                  shadowOffset={{ width: 0, height: 4 }}
                >
                  {menuItem.submenu?.map((subItem) => {
                    const isSubItemActive =
                      subItem.path && pathname.split("?")[0] === subItem.path.split("?")[0];

                    return (
                      <Link
                        key={subItem.title}
                        href={subItem.path || "#"}
                        style={{ textDecoration: "none" }}
                      >
                        <Theme name={isSubItemActive ? "active" : null}>
                          <Row
                            paddingHorizontal="$4"
                            paddingVertical="$2.5"
                            borderRadius="$md"
                            hoverStyle={{ backgroundColor: "$backgroundHover" }}
                          >
                            <Text size="$3" weight="medium">
                              {subItem.title}
                            </Text>
                          </Row>
                        </Theme>
                      </Link>
                    );
                  })}
                </Column>
              </>
            ) : (
              <Theme name={isActive ? "active" : null}>
                <Link href={menuItem.path || "#"} style={{ textDecoration: "none" }}>
                  <Row
                    paddingVertical="$2"
                    paddingHorizontal="$3"
                    borderRadius="$md"
                    hoverStyle={{ backgroundColor: "$backgroundHover" }}
                  >
                    <Text size="$3" weight="medium">
                      {menuItem.title}
                    </Text>
                  </Row>
                </Link>
              </Theme>
            )}
          </Column>
        );
      })}
    </Row>
  );
}
