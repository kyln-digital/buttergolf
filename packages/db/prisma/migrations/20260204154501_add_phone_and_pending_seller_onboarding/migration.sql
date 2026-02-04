-- AlterEnum
ALTER TYPE "PaymentHoldStatus" ADD VALUE 'PENDING_SELLER_ONBOARDING';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone" TEXT;
