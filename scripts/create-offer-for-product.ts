import { prisma, MessageType, OfferStatus } from "@buttergolf/db";

const PRODUCT_ID = "cmmalw2xi0005l2042jn36l3c";

async function main() {
  const product = await prisma.product.findUnique({
    where: { id: PRODUCT_ID },
    select: {
      id: true,
      title: true,
      price: true,
      userId: true,
    },
  });

  if (!product) {
    throw new Error(`Product not found: ${PRODUCT_ID}`);
  }

  const seller = await prisma.user.findUnique({
    where: { id: product.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!seller) {
    throw new Error(`Seller user not found for product ${PRODUCT_ID}`);
  }

  // Create a distinct non-Mike/non-Sarah buyer for testing.
  const buyerEmail = `alex.turner+${Date.now()}@buttergolf.test`;
  const buyer = await prisma.user.create({
    data: {
      clerkId: `dummy_alex_turner_${Date.now()}`,
      email: buyerEmail,
      firstName: "Alex",
      lastName: "Turner",
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  const offerAmount = Number((product.price * 0.8).toFixed(2));

  const result = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        productId: product.id,
        buyerId: buyer.id,
        sellerId: seller.id,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    const offer = await tx.offer.create({
      data: {
        amount: offerAmount,
        status: OfferStatus.PENDING,
        productId: product.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        conversationId: conversation.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: {
        id: true,
        amount: true,
        status: true,
      },
    });

    const message = await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: buyer.id,
        content: `Offer: GBP ${offerAmount.toFixed(2)}`,
        type: MessageType.OFFER,
        offerAmount,
        offerId: offer.id,
        isRead: false,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        updatedAt: new Date(),
      },
    });

    return { conversation, offer, message };
  });

  console.info(
    JSON.stringify(
      {
        product,
        seller,
        buyer,
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
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
