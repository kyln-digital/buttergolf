import { prisma } from "@buttergolf/db";

async function main() {
  const [users, conversations, messages, offers, products] = await Promise.all([
    prisma.user.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.offer.count(),
    prisma.product.count(),
  ]);

  console.info(JSON.stringify({ users, conversations, messages, offers, products }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
