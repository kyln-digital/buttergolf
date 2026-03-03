-- DropIndex
DROP INDEX IF EXISTS "messages_orderId_idx";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN IF EXISTS "orderId";
