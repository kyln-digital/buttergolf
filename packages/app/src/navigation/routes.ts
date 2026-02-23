/**
 * Define your app routes here.
 * These routes are shared between Next.js and Expo.
 */
export const routes = {
  home: "/",
  rounds: "/rounds",
  roundDetail: "/rounds/[id]",
  products: "/products",
  productDetail: "/products/[id]",
  category: "/category/[slug]",
  favourites: "/favourites",
  sell: "/sell",
  orders: "/orders",
  orderDetail: "/orders/[id]",
  messages: "/messages",
  messageThread: "/messages/[conversationId]",
  signIn: "/sign-in",
  signUp: "/sign-up",
  verifyEmail: "/verify-email",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  account: "/account",
} as const;

export type AppRoutes = typeof routes;
