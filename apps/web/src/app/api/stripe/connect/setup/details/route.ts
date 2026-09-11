import { NextResponse } from "next/server";
import { prisma } from "@buttergolf/db";
import { validatePayoutDetails, type PayoutDetailsInput } from "@buttergolf/constants";
import { stripe } from "@/lib/stripe";
import { readJsonObject } from "@/lib/json-body";
import { ensureDbUserFromRequest } from "@/lib/db-user";
import {
  describeStripeInputError,
  ensureConnectAccount,
  getConnectStatusForUser,
  getTosEvidenceFromRequest,
  sellerBusinessProfile,
} from "@/lib/stripe-connect";

/**
 * POST /api/stripe/connect/setup/details
 *
 * Step one of our own payout form: name, date of birth, address and phone.
 * The seller never sees a Stripe-rendered field — we validate here and push
 * the result to the connected account via accounts.update.
 *
 * Body: PayoutDetailsInput
 * Returns: the fresh PayoutStatus, or 400 { error, errors } on bad input.
 *
 * The date of birth is sent to Stripe and never stored by us.
 */
export async function POST(request: Request) {
  try {
    const dbUser = await ensureDbUserFromRequest(request);
    if (!dbUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "Check the highlighted fields" }, { status: 400 });
    }
    const validation = validatePayoutDetails(body as unknown as PayoutDetailsInput);
    if (!validation.ok || !validation.value) {
      return NextResponse.json(
        { error: "Check the highlighted fields", errors: validation.errors },
        { status: 400 }
      );
    }
    const details = validation.value;

    const user = await prisma.user.findUnique({
      where: { id: dbUser.id },
      select: { id: true, email: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tos = getTosEvidenceFromRequest(request);
    const accountId = await ensureConnectAccount({ userId: user.id, tos });

    try {
      await stripe.accounts.update(accountId, {
        individual: {
          first_name: details.firstName,
          last_name: details.lastName,
          dob: {
            day: details.dob.day,
            month: details.dob.month,
            year: details.dob.year,
          },
          address: {
            line1: details.address.line1,
            ...(details.address.line2 ? { line2: details.address.line2 } : {}),
            city: details.address.city,
            postal_code: details.address.postalCode,
            country: "GB",
          },
          phone: details.phone,
          ...(user.email ? { email: user.email } : {}),
        },
        // Every business_profile field classifyPayoutRequirement routes to this
        // step must be set here, or a seller could loop on a form that can't
        // satisfy what Stripe is asking for.
        business_profile: sellerBusinessProfile(),
        // Stripe expects a fresh acceptance whenever the platform collects
        // updated information on the account holder's behalf.
        ...(tos.ip
          ? {
              tos_acceptance: {
                date: Math.floor(Date.now() / 1000),
                ip: tos.ip,
                ...(tos.userAgent ? { user_agent: tos.userAgent.slice(0, 512) } : {}),
              },
            }
          : {}),
      });
    } catch (stripeError) {
      const described = describeStripeInputError(stripeError);
      if (described) {
        console.warn(`[Stripe Connect] Rejected payout details for user ${user.id}:`, described);
        return NextResponse.json(
          { error: described.message, param: described.param },
          { status: 400 }
        );
      }
      throw stripeError;
    }

    await persistDetails(user.id, details);

    const status = await getConnectStatusForUser(user.id);
    console.info(
      `[Stripe Connect] Saved payout details for user ${user.id}: status=${status.status}`
    );
    return NextResponse.json(status);
  } catch (error) {
    console.error("[Stripe Connect] Failed to save payout details:", error);
    return NextResponse.json({ error: "Failed to save your details" }, { status: 500 });
  }
}

/**
 * Keep our own copy of everything except the date of birth: the phone and
 * name on the user, and the address as their default `Address` (which the
 * shipping flow reuses as the sender address).
 */
async function persistDetails(
  userId: string,
  details: NonNullable<ReturnType<typeof validatePayoutDetails>["value"]>
): Promise<void> {
  const fullName = `${details.firstName} ${details.lastName}`.trim();

  await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: details.firstName,
      lastName: details.lastName,
      phone: details.phone,
    },
  });

  const addressData = {
    name: fullName,
    firstName: details.firstName,
    lastName: details.lastName,
    street1: details.address.line1,
    street2: details.address.line2 ?? "",
    city: details.address.city,
    zip: details.address.postalCode,
    country: "GB",
    phone: details.phone,
    isDefault: true,
  };

  const existingDefault = await prisma.address.findFirst({
    where: { userId, isDefault: true },
    select: { id: true },
  });

  if (existingDefault) {
    await prisma.address.update({ where: { id: existingDefault.id }, data: addressData });
  } else {
    await prisma.address.create({ data: { userId, ...addressData } });
  }
}
