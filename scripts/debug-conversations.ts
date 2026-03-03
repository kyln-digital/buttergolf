import { prisma } from "@buttergolf/db";

async function main() {
  const email = "josh@rwxt.org";

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      clerkId: true,
      firstName: true,
      lastName: true,
    },
  });

  console.info("USER", user);

  if (!user) return;

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ buyerId: user.id }, { sellerId: user.id }],
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      updatedAt: true,
      product: {
        select: {
          id: true,
          title: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          content: true,
          type: true,
          createdAt: true,
        },
      },
      offers: {
        where: { status: { in: ["PENDING", "COUNTERED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          amount: true,
        },
      },
    },
  });

  console.info("CONVERSATIONS", JSON.stringify(conversations, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
