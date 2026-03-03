import { prisma, MessageType, OfferStatus } from "@buttergolf/db";

async function main() {
  const productId = "cmmalw2xi0005l2042jn36l3c";
  const buyerId = "cmjhfz7930002r7r1iarr99ev";
  const offerAmount = 95;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      price: true,
      userId: true,
      isSold: true,
    },
  });

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  if (product.isSold) {
    throw new Error(`Product is sold: ${productId}`);
  }

  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (!buyer) {
    throw new Error(`Buyer not found: ${buyerId}`);
  }

  if (buyer.id === product.userId) {
    throw new Error("Buyer cannot be the seller");
  }

  const conversation = await prisma.conversation.upsert({
    where: {
      productId_buyerId_sellerId: {
        productId: product.id,
        buyerId,
        sellerId: product.userId,
      },
    },
    create: {
      productId: product.id,
      buyerId,
      sellerId: product.userId,
    },
    update: {
      updatedAt: new Date(),
    },
    select: { id: true },
  });

  await prisma.offer.updateMany({
    where: {
      conversationId: conversation.id,
      status: { in: ["PENDING", "COUNTERED"] },
    },
    data: { status: OfferStatus.REJECTED },
  });

  const offer = await prisma.offer.create({
    data: {
      amount: offerAmount,
      status: OfferStatus.PENDING,
      productId: product.id,
      buyerId,
      sellerId: product.userId,
      conversationId: conversation.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    select: { id: true, amount: true, status: true, createdAt: true },
  });

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: buyerId,
      content: `Offer: GBP ${offerAmount.toFixed(2)}`,
      type: MessageType.OFFER,
      offerAmount,
      offerId: offer.id,
      isRead: false,
    },
    select: { id: true, createdAt: true },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  console.info(
    JSON.stringify(
      {
        ok: true,
        buyer,
        product: {
          id: product.id,
          title: product.title,
          price: product.price,
          sellerId: product.userId,
        },
        conversationId: conversation.id,
        offer,
        message,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
