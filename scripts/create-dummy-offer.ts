import path from "node:path";
import dotenv from "dotenv";
import { prisma, ProductCondition, OfferStatus, MessageType } from "@buttergolf/db";

dotenv.config({ path: path.resolve(process.cwd(), "packages/db/.env") });

type User = { id: string; email: string; firstName: string; lastName: string };

async function main() {
  const joshEmail = "josh@rwxt.org";

  const josh = await prisma.user.findUnique({
    where: { email: joshEmail },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (!josh) {
    throw new Error(`User not found for email: ${joshEmail}`);
  }

  const mikeEmail = "mike.chen+dummy@buttergolf.test";
  const mikeClerkId = "dummy_mike_chen_offer_tester";

  const mike = await prisma.user.upsert({
    where: { email: mikeEmail },
    update: {
      firstName: "Mike",
      lastName: "Chen",
    },
    create: {
      email: mikeEmail,
      clerkId: mikeClerkId,
      firstName: "Mike",
      lastName: "Chen",
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  const category = await prisma.category.findFirst({
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" },
  });

  if (!category) {
    throw new Error("No category found. Seed categories first.");
  }

  const price = 350;
  const offerAmount = 275;

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        title: `Dummy Offer Test Club ${new Date().toISOString().slice(0, 19)}`,
        description: "Test product created by script for offer-flow QA.",
        price,
        condition: ProductCondition.GOOD,
        userId: josh.id,
        categoryId: category.id,
        isSold: false,
      },
      select: { id: true, title: true },
    });

    await tx.productImage.create({
      data: {
        productId: product.id,
        url: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2",
        sortOrder: 0,
      },
    });

    const conversation = await tx.conversation.create({
      data: {
        productId: product.id,
        buyerId: mike.id,
        sellerId: josh.id,
      },
      select: { id: true },
    });

    const offer = await tx.offer.create({
      data: {
        amount: offerAmount,
        status: OfferStatus.PENDING,
        productId: product.id,
        buyerId: mike.id,
        sellerId: josh.id,
        conversationId: conversation.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: { id: true, amount: true, status: true },
    });

    const message = await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: mike.id,
        content: `Offer: GBP ${offerAmount.toFixed(2)}`,
        type: MessageType.OFFER,
        offerAmount,
        offerId: offer.id,
        isRead: false,
      },
      select: { id: true, createdAt: true },
    });

    await tx.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return { product, conversation, offer, message };
  });

  const j = josh as User;
  const m = mike as User;

  console.info("Dummy offer created successfully");
  console.info(
    JSON.stringify(
      {
        seller: j,
        buyer: m,
        category,
        product: result.product,
        conversationId: result.conversation.id,
        offer: result.offer,
        message: result.message,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
