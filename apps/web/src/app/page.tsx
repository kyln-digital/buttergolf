import { auth } from "@clerk/nextjs/server";
import MarketplaceHomeClient from "./_components/MarketplaceHomeClient";
import { getRecentProducts, getMyProducts } from "./actions/products";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [products, { userId: clerkId }] = await Promise.all([getRecentProducts(12), auth()]);

  const myProducts = clerkId ? await getMyProducts(12) : null;

  return <MarketplaceHomeClient products={products} myProducts={myProducts} />;
}
