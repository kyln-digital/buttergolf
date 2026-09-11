"use client";

import { Input, Row, Button } from "@buttergolf/ui";
import { Search } from "@tamagui/lucide-icons";

export interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
}

export function SearchBar({
  placeholder = "Search for golf equipment...",
  onSearch,
}: Readonly<SearchBarProps>) {
  return (
    <Row width="100%" maxWidth={600} gap="$xs" alignItems="center">
      <Input
        flex={1}
        size="$4"
        placeholder={placeholder}
        borderRadius="$10"
        paddingLeft="$4"
        backgroundColor="$surface"
        borderColor="$border"
        color="$text"
        focusStyle={{
          borderColor: "$borderFocus",
          borderWidth: 2,
        }}
      />
      <Button
        butterVariant="primary"
        size="$4"
        icon={Search}
        borderRadius="$10"
        onPress={() => onSearch?.("")}
      >
        Search
      </Button>
    </Row>
  );
}
