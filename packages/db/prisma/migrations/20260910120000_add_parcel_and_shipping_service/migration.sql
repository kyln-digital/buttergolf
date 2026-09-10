-- AlterTable
-- Which parcel preset the seller picked when listing. The resolved dimensions
-- stay in the existing length/width/height/weight columns.
ALTER TABLE "products" ADD COLUMN "parcelPresetId" TEXT;

-- AlterTable
-- The shipping option the buyer selected and paid for at checkout. Previously
-- this only reached Stripe metadata and was dropped on the floor at order
-- creation, so the purchased label could be any carrier/service.
ALTER TABLE "orders" ADD COLUMN "shippingOptionId" TEXT,
                     ADD COLUMN "shippingServiceName" TEXT;

-- AlterTable
-- Surface label-purchase failures. Auto-generation runs fire-and-forget after
-- payment, so a failure was previously only a console.warn in a lambda log.
ALTER TABLE "orders" ADD COLUMN "labelError" TEXT,
                     ADD COLUMN "labelAttemptedAt" TIMESTAMP(3);
