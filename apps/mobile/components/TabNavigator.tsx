import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Dimensions, StyleSheet, Animated as RNAnimated } from "react-native";
import { TabView, SceneRendererProps, NavigationState } from "react-native-tab-view";
import { Row, Column, Text } from "@buttergolf/ui";
import {
  Home,
  Heart,
  PlusCircle,
  MessageCircle,
  User,
} from "@tamagui/lucide-icons";

// Tab routes - only swipeable tabs (Sell is modal, Account is separate)
export type TabRoute = {
  key: "home" | "favourites" | "messages";
  title: string;
};

const TAB_ROUTES: TabRoute[] = [
  { key: "home", title: "Home" },
  { key: "favourites", title: "Wishlist" },
  { key: "messages", title: "Messages" },
];

interface TabNavigatorProps {
  /** Render function for Home tab content */
  renderHome: () => React.ReactNode;
  /** Render function for Favourites tab content */
  renderFavourites: () => React.ReactNode;
  /** Render function for Messages tab content */
  renderMessages: () => React.ReactNode;
  /** Called when Sell button is pressed (opens modal) */
  onSellPress: () => void;
  /** Called when Account button is pressed */
  onAccountPress: () => void;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Called when Login is pressed (for non-authenticated users) */
  onLoginPress?: () => void;
  /** Initial tab index */
  initialIndex?: number;
  /** Called when tab changes (for analytics, etc.) */
  onTabChange?: (key: string) => void;
}

const initialLayout = { width: Dimensions.get("window").width };

/**
 * TabNavigator with horizontal swipe gestures and animated indicator.
 * Uses react-native-tab-view for smooth native paging.
 * 
 * Only Home, Favourites, and Messages are swipeable.
 * Sell opens as modal, Account is a separate stack screen.
 */
export function TabNavigator({
  renderHome,
  renderFavourites,
  renderMessages,
  onSellPress,
  onAccountPress,
  isAuthenticated,
  onLoginPress,
  initialIndex = 0,
  onTabChange,
}: TabNavigatorProps) {
  const [index, setIndex] = useState(initialIndex);
  const [routes] = useState(TAB_ROUTES);

  // Handle tab index change
  const handleIndexChange = useCallback(
    (newIndex: number) => {
      setIndex(newIndex);
      const route = routes[newIndex];
      if (route && onTabChange) {
        onTabChange(route.key);
      }
    },
    [routes, onTabChange]
  );

  // Render scene for each tab - uses lazy loading
  const renderScene = useCallback(
    ({ route }: SceneRendererProps & { route: TabRoute }) => {
      switch (route.key) {
        case "home":
          return <>{renderHome()}</>;
        case "favourites":
          return <>{renderFavourites()}</>;
        case "messages":
          return <>{renderMessages()}</>;
        default:
          return null;
      }
    },
    [renderHome, renderFavourites, renderMessages]
  );

  // Custom tab bar with animated indicator
  const renderTabBar = useCallback(
    (props: SceneRendererProps & { navigationState: NavigationState<TabRoute> }) => (
      <AnimatedTabBar
        {...props}
        onSellPress={onSellPress}
        onAccountPress={onAccountPress}
        isAuthenticated={isAuthenticated}
        onLoginPress={onLoginPress}
      />
    ),
    [onSellPress, onAccountPress, isAuthenticated, onLoginPress]
  );

  // Lazy rendering config - render adjacent tabs
  const lazy = useCallback(() => {
    // Always render adjacent tabs for smooth swiping
    return true;
  }, []);

  return (
    <TabView
      navigationState={{ index, routes }}
      renderScene={renderScene}
      renderTabBar={renderTabBar}
      onIndexChange={handleIndexChange}
      initialLayout={initialLayout}
      lazy={lazy}
      lazyPreloadDistance={1} // Preload 1 tab on each side
      tabBarPosition="bottom"
      swipeEnabled={true}
      animationEnabled={true}
    />
  );
}

interface AnimatedTabBarProps extends SceneRendererProps {
  navigationState: NavigationState<TabRoute>;
  onSellPress: () => void;
  onAccountPress: () => void;
  isAuthenticated: boolean;
  onLoginPress?: () => void;
}

/**
 * Custom tab bar with animated indicator that follows swipe position.
 * Shows 5 tabs but only 3 are swipeable (Home, Wishlist, Messages).
 * Sell opens modal, Account navigates to stack screen.
 */
function AnimatedTabBar({
  navigationState,
  jumpTo,
  onSellPress,
  onAccountPress,
  isAuthenticated,
  onLoginPress,
}: AnimatedTabBarProps) {
  const { routes, index: currentIndex } = navigationState;
  const inactiveOpacity = 0.55;
  const activeOpacity = 1;

  // Calculate indicator width and position
  // We have 5 visual tabs but only 3 are in the pager
  // Visual order: Home(0) | Wishlist(1) | Sell(not in pager) | Messages(2) | Account(not in pager)
  // Map pager index to visual position for the indicator
  const screenWidth = Dimensions.get("window").width;
  const tabCount = 5; // Visual tabs
  const tabWidth = screenWidth / tabCount;

  // Map pager index to visual position
  // Pager: home=0, favourites=1, messages=2
  // Visual: home=0, favourites=1, sell=2, messages=3, account=4
  const pagerToVisual = useMemo(() => [0, 1, 3], []);
  const visualIndex = pagerToVisual[currentIndex] ?? 0;
  const targetPosition = visualIndex * tabWidth + tabWidth / 2 - 12;

  // Animated value for smooth indicator transitions
  // Using useState to avoid React compiler warning about refs during render
  const [indicatorAnim] = useState(() => new RNAnimated.Value(targetPosition));

  // Animate indicator when tab changes
  useEffect(() => {
    RNAnimated.spring(indicatorAnim, {
      toValue: targetPosition,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  }, [targetPosition, indicatorAnim]);

  // Check if a tab is currently active (for styling)
  const isTabActive = useCallback(
    (tabKey: string) => {
      const route = routes[currentIndex];
      return route?.key === tabKey;
    },
    [routes, currentIndex]
  );

  return (
    <Column
      backgroundColor="$surface"
      borderTopLeftRadius="$2xl"
      borderTopRightRadius="$2xl"
      shadowColor="rgba(0, 0, 0, 0.15)"
      shadowOffset={{ width: 0, height: -4 }}
      shadowOpacity={1}
      shadowRadius={8}
      elevation={8}
      paddingTop="$2"
      paddingBottom="$6"
    >
      {/* Animated indicator dot */}
      <RNAnimated.View
        style={[
          styles.indicator,
          { transform: [{ translateX: indicatorAnim }] },
        ]}
      />
      
      <Row
        alignItems="center"
        justifyContent="space-around"
        paddingHorizontal="$2"
        paddingTop="$1"
      >
        {/* Home - swipeable */}
        <TabButton
          icon={Home}
          label="Home"
          isActive={isTabActive("home")}
          activeOpacity={activeOpacity}
          inactiveOpacity={inactiveOpacity}
          onPress={() => jumpTo("home")}
        />

        {/* Wishlist/Favourites - swipeable */}
        <TabButton
          icon={Heart}
          label="Wishlist"
          isActive={isTabActive("favourites")}
          activeOpacity={activeOpacity}
          inactiveOpacity={inactiveOpacity}
          onPress={() => jumpTo("favourites")}
        />

        {/* Sell - opens modal (not in pager) */}
        <TabButton
          icon={PlusCircle}
          label="Sell"
          isActive={false}
          activeOpacity={activeOpacity}
          inactiveOpacity={inactiveOpacity}
          onPress={onSellPress}
        />

        {/* Messages - swipeable */}
        <TabButton
          icon={MessageCircle}
          label="Messages"
          isActive={isTabActive("messages")}
          activeOpacity={activeOpacity}
          inactiveOpacity={inactiveOpacity}
          onPress={() => jumpTo("messages")}
        />

        {/* Account - separate screen (not in pager) */}
        <TabButton
          icon={User}
          label="Account"
          isActive={false}
          activeOpacity={activeOpacity}
          inactiveOpacity={inactiveOpacity}
          onPress={isAuthenticated ? onAccountPress : onLoginPress}
        />
      </Row>
    </Column>
  );
}

interface TabButtonProps {
  icon: typeof Home;
  label: string;
  isActive: boolean;
  activeOpacity: number;
  inactiveOpacity: number;
  onPress?: () => void;
}

function TabButton({
  icon: Icon,
  label,
  isActive,
  activeOpacity,
  inactiveOpacity,
  onPress,
}: TabButtonProps) {
  return (
    <Column
      gap="$1"
      alignItems="center"
      minWidth={60}
      paddingVertical="$2"
      paddingHorizontal="$2"
      onPress={onPress}
      cursor="pointer"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
    >
      <Icon
        size={24}
        color="$primary"
        opacity={isActive ? activeOpacity : inactiveOpacity}
      />
      <Text
        size="$1"
        color="$primary"
        opacity={isActive ? activeOpacity : inactiveOpacity}
        fontWeight={isActive ? "600" : "400"}
      >
        {label}
      </Text>
    </Column>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: "absolute",
    top: 0,
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#F45314", // $primary / Spiced Clementine
  },
});

export default TabNavigator;
