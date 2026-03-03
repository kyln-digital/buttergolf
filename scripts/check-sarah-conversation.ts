import { prisma } from "@buttergolf/db";

async function main() {
  const me = await prisma.user.findUnique({
    where: { email: "josh@rwxt.org" },
    select: { id: true },
  });

  if (!me) {
    console.info("NO_USER");
    return;
  }

  const rows = await prisma.conversation.findMany({
    where: {
      OR: [{ buyerId: me.id }, { sellerId: me.id }],
    },
    include: {
      buyer: { select: { firstName: true, lastName: true } },
      seller: { select: { firstName: true, lastName: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          content: true,
          type: true,
          offerAmount: true,
          createdAt: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const mapped = rows.map((conversation) => {
    const buyerName =
      `${conversation.buyer.firstName || ""} ${conversation.buyer.lastName || ""}`.trim();
    const sellerName =
      `${conversation.seller.firstName || ""} ${conversation.seller.lastName || ""}`.trim();
    const otherUser = conversation.buyerId === me.id ? sellerName : buyerName;

    return {
      id: conversation.id,
      otherUser,
      latestMessages: conversation.messages,
    };
  });

  const sarahConversations = mapped.filter((conversation) =>
    conversation.otherUser.toLowerCase().includes("sarah johnson")
  );

  console.info(JSON.stringify({ totalConversations: mapped.length, sarahConversations }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
