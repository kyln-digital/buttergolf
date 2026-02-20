import { Resend } from "resend";

/**
 * Email Service using Resend
 *
 * Handles all transactional emails for ButterGolf:
 * - Order confirmations
 * - New sale notifications
 * - Shipping updates
 * - New message notifications
 *
 * Environment: RESEND_API_KEY
 */

// Lazy-initialize Resend client to avoid build-time errors when RESEND_API_KEY is not set
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Use verified Resend domain for sending emails
const FROM_EMAIL = "ButterGolf <notifications@notifications.buttergolf.com>";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://buttergolf.co.uk";

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Generic email sending function for custom emails
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<EmailResult> {
  const { to, subject, html, from = FROM_EMAIL } = params;

  try {
    const { data, error } = await getResendClient().emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Error sending email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Exception sending email:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Send order confirmation email to buyer
 */
export async function sendOrderConfirmationEmail(params: {
  buyerEmail: string;
  buyerName: string;
  orderId: string;
  productTitle: string;
  productImage?: string;
  amountTotal: number;
  sellerName: string;
}): Promise<EmailResult> {
  const { buyerEmail, buyerName, orderId, productTitle, amountTotal, sellerName } = params;

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: buyerEmail,
      subject: `Order Confirmed: ${productTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #F45314; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .order-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #F45314; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✓ Order Confirmed!</h1>
            </div>
            <div class="content">
              <p>Hi ${buyerName},</p>
              <p>Great news! Your order has been confirmed and the seller has been notified.</p>
              
              <div class="order-box">
                <h3 style="margin-top: 0;">Order Details</h3>
                <p><strong>Order ID:</strong> ${orderId.slice(0, 8).toUpperCase()}</p>
                <p><strong>Product:</strong> ${productTitle}</p>
                <p><strong>Seller:</strong> ${sellerName}</p>
                <p><strong>Total Paid:</strong> £${amountTotal.toFixed(2)}</p>
              </div>
              
              <h3>What happens next?</h3>
              <ul>
                <li>The seller will prepare your item and create a shipping label</li>
                <li>You'll receive tracking information once shipped</li>
                <li>Track your order anytime in your account</li>
              </ul>
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${BASE_URL}/orders/${orderId}" class="button">View Order</a>
              </p>
            </div>
            <div class="footer">
              <p>Thank you for shopping with ButterGolf!</p>
              <p>Questions? Reply to this email or visit our help centre.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Send new sale notification email to seller
 */
export async function sendNewSaleEmail(params: {
  sellerEmail: string;
  sellerName: string;
  orderId: string;
  productTitle: string;
  buyerName: string;
  amountTotal: number;
  sellerPayout: number;
  shippingAddress: {
    city: string;
    zip: string;
  };
}): Promise<EmailResult> {
  const {
    sellerEmail,
    sellerName,
    orderId,
    productTitle,
    buyerName,
    amountTotal,
    sellerPayout,
    shippingAddress,
  } = params;

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: sellerEmail,
      subject: `You made a sale! ${productTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #F45314; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .order-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .payout-box { background: #02aaa4; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .button { display: inline-block; background: #F45314; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Congratulations!</h1>
            </div>
            <div class="content">
              <p>Hi ${sellerName},</p>
              <p>You just made a sale! Time to ship it out.</p>
              
              <div class="payout-box">
                <p style="margin: 0; font-size: 14px;">Your Payout</p>
                <p style="margin: 5px 0 0 0; font-size: 32px; font-weight: bold;">£${sellerPayout.toFixed(2)}</p>
              </div>
              
              <div class="order-box">
                <h3 style="margin-top: 0;">Order Details</h3>
                <p><strong>Order ID:</strong> ${orderId.slice(0, 8).toUpperCase()}</p>
                <p><strong>Product:</strong> ${productTitle}</p>
                <p><strong>Buyer:</strong> ${buyerName}</p>
                <p><strong>Ship To:</strong> ${shippingAddress.city}, ${shippingAddress.zip}</p>
                <p><strong>Order Total:</strong> £${amountTotal.toFixed(2)}</p>
              </div>
              
              <h3>Next Steps:</h3>
              <ol>
                <li>Go to your Sales dashboard</li>
                <li>Click "Generate Label" to get your shipping label</li>
                <li>Print the label and attach it to your package</li>
                <li>Drop off at your nearest carrier location</li>
              </ol>
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${BASE_URL}/seller/sales" class="button">Generate Shipping Label</a>
              </p>
            </div>
            <div class="footer">
              <p>Thanks for selling on ButterGolf!</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Send shipping notification email to buyer
 */
export async function sendShippedEmail(params: {
  buyerEmail: string;
  buyerName: string;
  orderId: string;
  productTitle: string;
  trackingCode: string;
  trackingUrl: string;
  carrier: string;
  estimatedDelivery?: string;
}): Promise<EmailResult> {
  const {
    buyerEmail,
    buyerName,
    orderId,
    productTitle,
    trackingCode,
    trackingUrl,
    carrier,
    estimatedDelivery,
  } = params;

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: buyerEmail,
      subject: `Your order is on its way! ${productTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #F45314; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .tracking-box { background: #3c50e0; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .button { display: inline-block; background: #F45314; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .button-secondary { display: inline-block; background: white; color: #F45314; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; border: 2px solid #F45314; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Order Has Shipped!</h1>
            </div>
            <div class="content">
              <p>Hi ${buyerName},</p>
              <p>Great news! Your order is on its way to you.</p>
              
              <div class="tracking-box">
                <p style="margin: 0; font-size: 14px;">Tracking Number</p>
                <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold;">${trackingCode}</p>
                <p style="margin: 10px 0 0 0; font-size: 14px;">via ${carrier}</p>
                ${estimatedDelivery ? `<p style="margin: 10px 0 0 0; font-size: 14px;">Est. Delivery: ${new Date(estimatedDelivery).toLocaleDateString()}</p>` : ""}
              </div>
              
              <p><strong>Product:</strong> ${productTitle}</p>
              <p><strong>Order ID:</strong> ${orderId.slice(0, 8).toUpperCase()}</p>
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${trackingUrl}" class="button">Track Package</a>
              </p>
              <p style="text-align: center; margin-top: 15px;">
                <a href="${BASE_URL}/orders/${orderId}" class="button-secondary">View Order</a>
              </p>
            </div>
            <div class="footer">
              <p>Happy golfing!</p>
              <p>The ButterGolf Team</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Send new message notification email
 */
export async function sendNewMessageEmail(params: {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  orderId: string;
  productTitle: string;
  messagePreview: string;
}): Promise<EmailResult> {
  const { recipientEmail, recipientName, senderName, orderId, productTitle, messagePreview } =
    params;

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `New message about your order: ${productTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #F45314; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 20px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .message-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F45314; }
            .button { display: inline-block; background: #F45314; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Message</h1>
            </div>
            <div class="content">
              <p>Hi ${recipientName},</p>
              <p><strong>${senderName}</strong> sent you a message about order <strong>${orderId.slice(0, 8).toUpperCase()}</strong>:</p>
              
              <div class="message-box">
                <p style="margin: 0; font-style: italic;">"${messagePreview.slice(0, 200)}${messagePreview.length > 200 ? "..." : ""}"</p>
              </div>
              
              <p><strong>Product:</strong> ${productTitle}</p>
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${BASE_URL}/orders/${orderId}" class="button">View & Reply</a>
              </p>
            </div>
            <div class="footer">
              <p>Reply directly on ButterGolf to keep the conversation in one place.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Send delivery confirmation email to both parties
 */
export async function sendDeliveredEmail(params: {
  email: string;
  name: string;
  orderId: string;
  productTitle: string;
  isBuyer: boolean;
}): Promise<EmailResult> {
  const { email, name, orderId, productTitle, isBuyer } = params;

  const subject = isBuyer
    ? `Your order has been delivered! ${productTitle}`
    : `Your sale has been delivered! ${productTitle}`;

  const message = isBuyer
    ? "Your package has been delivered! We hope you love your new golf gear."
    : "Great news! The buyer has received their package.";

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #02aaa4; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #F45314; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Delivered!</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>${message}</p>
              
              <p><strong>Product:</strong> ${productTitle}</p>
              <p><strong>Order ID:</strong> ${orderId.slice(0, 8).toUpperCase()}</p>
              
              ${
                isBuyer
                  ? `
                <p>If you're happy with your purchase, please leave a review for the seller!</p>
                <p style="text-align: center; margin-top: 30px;">
                  <a href="${BASE_URL}/orders/${orderId}" class="button">Leave a Review</a>
                </p>
              `
                  : `
                <p>Your payout will be processed according to your Stripe payout schedule.</p>
                <p style="text-align: center; margin-top: 30px;">
                  <a href="${BASE_URL}/seller/payouts" class="button">View Payouts</a>
                </p>
              `
              }
            </div>
            <div class="footer">
              <p>Thanks for using ButterGolf!</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Send label generated email to buyer (PRE_TRANSIT status)
 */
export async function sendLabelGeneratedEmail(params: {
  buyerEmail: string;
  buyerName: string;
  orderId: string;
  productTitle: string;
  estimatedDelivery?: string;
  carrier?: string | null;
}): Promise<EmailResult> {
  const { buyerEmail, buyerName, orderId, productTitle, estimatedDelivery, carrier } = params;

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: buyerEmail,
      subject: `Shipping label created for: ${productTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #F45314; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #F45314; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Shipping Label Created</h1>
            </div>
            <div class="content">
              <p>Hi ${buyerName},</p>
              <p>Good news! The seller has created a shipping label for your order. Your package will be dropped off soon.</p>

              <div class="info-box">
                <h3 style="margin-top: 0;">Order Details</h3>
                <p><strong>Product:</strong> ${productTitle}</p>
                <p><strong>Order ID:</strong> ${orderId.slice(0, 8).toUpperCase()}</p>
                ${carrier ? `<p><strong>Carrier:</strong> ${carrier}</p>` : ""}
                ${estimatedDelivery ? `<p><strong>Est. Delivery:</strong> ${new Date(estimatedDelivery).toLocaleDateString()}</p>` : ""}
              </div>

              <h3>What happens next?</h3>
              <ul>
                <li>The seller will drop off the package at ${carrier || "the carrier"}</li>
                <li>Once it's scanned by the carrier, you'll receive tracking updates</li>
                <li>You can track your package anytime in your order history</li>
              </ul>

              <p style="text-align: center; margin-top: 30px;">
                <a href="${BASE_URL}/orders/${orderId}" class="button">View Order</a>
              </p>
            </div>
            <div class="footer">
              <p>Your package is on its way!</p>
              <p>The ButterGolf Team</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Send in transit email to buyer (IN_TRANSIT status)
 */
export async function sendInTransitEmail(params: {
  buyerEmail: string;
  buyerName: string;
  orderId: string;
  productTitle: string;
  trackingCode: string | null;
  trackingUrl: string | null;
  carrier: string | null;
  currentLocation?: string;
  estimatedDelivery?: string;
}): Promise<EmailResult> {
  const {
    buyerEmail,
    buyerName,
    orderId,
    productTitle,
    trackingCode,
    trackingUrl,
    carrier,
    currentLocation,
    estimatedDelivery,
  } = params;

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: buyerEmail,
      subject: `Your package is on the move! ${productTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #F45314; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .tracking-box { background: #3c50e0; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .location-box { background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F45314; }
            .button { display: inline-block; background: #F45314; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Package In Transit!</h1>
            </div>
            <div class="content">
              <p>Hi ${buyerName},</p>
              <p>Your package is on the move and heading your way!</p>

              ${
                currentLocation
                  ? `
              <div class="location-box">
                <p style="margin: 0; font-size: 14px; color: #545454;">Current Location</p>
                <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #323232;">${currentLocation}</p>
              </div>
              `
                  : ""
              }

              <div class="tracking-box">
                <p style="margin: 0; font-size: 14px;">Tracking Number</p>
                <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold;">${trackingCode || "N/A"}</p>
                ${carrier ? `<p style="margin: 10px 0 0 0; font-size: 14px;">via ${carrier}</p>` : ""}
                ${estimatedDelivery ? `<p style="margin: 10px 0 0 0; font-size: 14px;">Est. Delivery: ${new Date(estimatedDelivery).toLocaleDateString()}</p>` : ""}
              </div>

              <p><strong>Product:</strong> ${productTitle}</p>
              <p><strong>Order ID:</strong> ${orderId.slice(0, 8).toUpperCase()}</p>

              ${
                trackingUrl
                  ? `
              <p style="text-align: center; margin-top: 30px;">
                <a href="${trackingUrl}" class="button">Track Your Package</a>
              </p>
              `
                  : `
              <p style="text-align: center; margin-top: 30px;">
                <a href="${BASE_URL}/orders/${orderId}" class="button">View Order Details</a>
              </p>
              `
              }
            </div>
            <div class="footer">
              <p>Tracking updates will continue as your package moves!</p>
              <p>The ButterGolf Team</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Send out for delivery email to buyer (OUT_FOR_DELIVERY status)
 */
export async function sendOutForDeliveryEmail(params: {
  buyerEmail: string;
  buyerName: string;
  orderId: string;
  productTitle: string;
  trackingCode: string | null;
  trackingUrl: string | null;
}): Promise<EmailResult> {
  const { buyerEmail, buyerName, orderId, productTitle, trackingCode, trackingUrl } = params;

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: buyerEmail,
      subject: `🚚 Your package arrives TODAY! ${productTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #02aaa4; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .alert-box { background: #02aaa4; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .button { display: inline-block; background: #F45314; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
            .checklist { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚚 Out for Delivery TODAY!</h1>
            </div>
            <div class="content">
              <p>Hi ${buyerName},</p>

              <div class="alert-box">
                <p style="margin: 0; font-size: 24px; font-weight: bold;">Your package arrives today!</p>
                <p style="margin: 10px 0 0 0; font-size: 16px;">Keep an eye out for the delivery driver</p>
              </div>

              <p><strong>Product:</strong> ${productTitle}</p>
              <p><strong>Order ID:</strong> ${orderId.slice(0, 8).toUpperCase()}</p>
              ${trackingCode ? `<p><strong>Tracking:</strong> ${trackingCode}</p>` : ""}

              <div class="checklist">
                <h3 style="margin-top: 0;">What to expect:</h3>
                <ul style="margin-bottom: 0;">
                  <li>Your package is currently with the delivery driver</li>
                  <li>Delivery typically occurs during business hours</li>
                  <li>You may receive a knock or doorbell ring</li>
                  <li>Some carriers require a signature</li>
                </ul>
              </div>

              ${
                trackingUrl
                  ? `
              <p style="text-align: center; margin-top: 30px;">
                <a href="${trackingUrl}" class="button">Track in Real-Time</a>
              </p>
              `
                  : `
              <p style="text-align: center; margin-top: 30px;">
                <a href="${BASE_URL}/orders/${orderId}" class="button">View Order Details</a>
              </p>
              `
              }
            </div>
            <div class="footer">
              <p>Almost there! Enjoy your new golf gear!</p>
              <p>The ButterGolf Team</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Send auto-release reminder email to buyer
 * Sent X days before payment is auto-released to seller
 */
export async function sendAutoReleaseReminderEmail(params: {
  buyerEmail: string;
  buyerName: string;
  orderId: string;
  productTitle: string;
  daysUntilRelease: number;
  autoReleaseDate: Date;
  sellerPayout: number;
}): Promise<EmailResult> {
  const {
    buyerEmail,
    buyerName,
    orderId,
    productTitle,
    daysUntilRelease,
    autoReleaseDate,
    sellerPayout,
  } = params;

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: buyerEmail,
      subject: `⏰ ${daysUntilRelease} days left to confirm receipt: ${productTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #F45314; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .alert-box { background: #F45314; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #F45314; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .button-secondary { display: inline-block; background: white; color: #F45314; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; border: 2px solid #F45314; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Action Required</h1>
            </div>
            <div class="content">
              <p>Hi ${buyerName},</p>
              
              <div class="alert-box">
                <p style="margin: 0; font-size: 24px; font-weight: bold;">${daysUntilRelease} days left</p>
                <p style="margin: 10px 0 0 0; font-size: 14px;">to confirm you received your item</p>
              </div>
              
              <p>Your order for <strong>${productTitle}</strong> was marked as delivered. If you've received it and are happy with your purchase, please confirm receipt.</p>
              
              <div class="info-box">
                <h3 style="margin-top: 0;">What happens next?</h3>
                <ul style="margin-bottom: 0;">
                  <li><strong>If you confirm receipt:</strong> Payment of £${sellerPayout.toFixed(2)} is released to the seller</li>
                  <li><strong>If you don't confirm:</strong> Payment will be automatically released on ${autoReleaseDate.toLocaleDateString()}</li>
                  <li><strong>If there's an issue:</strong> Report a problem before the deadline to keep payment held</li>
                </ul>
              </div>
              
              <p><strong>Order ID:</strong> ${orderId.slice(0, 8).toUpperCase()}</p>
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${BASE_URL}/orders/${orderId}" class="button">Confirm Receipt</a>
              </p>
              <p style="text-align: center; margin-top: 15px;">
                <a href="${BASE_URL}/orders/${orderId}#report" class="button-secondary">Report a Problem</a>
              </p>
            </div>
            <div class="footer">
              <p>Your payment is protected until you confirm receipt or the auto-release date.</p>
              <p>The ButterGolf Team</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Send payment released notification to seller
 */
export async function sendPaymentReleasedEmail(params: {
  sellerEmail: string;
  sellerName: string;
  orderId: string;
  productTitle: string;
  payoutAmount: number;
  releaseReason: "buyer_confirmed" | "auto_released";
}): Promise<EmailResult> {
  const { sellerEmail, sellerName, orderId, productTitle, payoutAmount, releaseReason } = params;

  const reasonText =
    releaseReason === "buyer_confirmed"
      ? "The buyer confirmed they received their item."
      : "The payment was automatically released after 14 days.";

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: sellerEmail,
      subject: `Payment released! £${payoutAmount.toFixed(2)} for ${productTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #02aaa4; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .payout-box { background: #02aaa4; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #F45314; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Released!</h1>
            </div>
            <div class="content">
              <p>Hi ${sellerName},</p>
              
              <div class="payout-box">
                <p style="margin: 0; font-size: 14px;">Your Payout</p>
                <p style="margin: 5px 0 0 0; font-size: 36px; font-weight: bold;">£${payoutAmount.toFixed(2)}</p>
                <p style="margin: 10px 0 0 0; font-size: 14px;">is on its way to your bank</p>
              </div>
              
              <p>${reasonText}</p>
              
              <div class="info-box">
                <h3 style="margin-top: 0;">Order Details</h3>
                <p><strong>Product:</strong> ${productTitle}</p>
                <p><strong>Order ID:</strong> ${orderId.slice(0, 8).toUpperCase()}</p>
                <p><strong>Status:</strong> Payment Released</p>
              </div>
              
              <p>The funds will be transferred to your bank account according to your Stripe payout schedule (usually 2-7 business days).</p>
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${BASE_URL}/seller/payouts" class="button">View Payouts</a>
              </p>
            </div>
            <div class="footer">
              <p>Thanks for selling on ButterGolf!</p>
              <p>Keep listing to keep earning</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Send payment on hold notification to buyer (after purchase)
 */
export async function sendPaymentOnHoldEmail(params: {
  buyerEmail: string;
  buyerName: string;
  orderId: string;
  productTitle: string;
  autoReleaseDate: Date;
}): Promise<EmailResult> {
  const { buyerEmail, buyerName, orderId, productTitle, autoReleaseDate } = params;

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: buyerEmail,
      subject: `Your payment is protected: ${productTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3c50e0; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .protection-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3c50e0; }
            .button { display: inline-block; background: #F45314; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Buyer Protection Active</h1>
            </div>
            <div class="content">
              <p>Hi ${buyerName},</p>
              <p>Your purchase is protected! We're holding the payment until you confirm you've received your item.</p>
              
              <div class="protection-box">
                <h3 style="margin-top: 0;">How it works:</h3>
                <ol style="margin-bottom: 0;">
                  <li><strong>Payment is held securely</strong> - The seller doesn't receive the money yet</li>
                  <li><strong>You receive your item</strong> - Wait for delivery and inspect it</li>
                  <li><strong>Confirm receipt</strong> - Once you're happy, confirm and we release payment</li>
                  <li><strong>Auto-release date:</strong> ${autoReleaseDate.toLocaleDateString()} - Payment releases automatically if you don't respond</li>
                </ol>
              </div>
              
              <p><strong>Product:</strong> ${productTitle}</p>
              <p><strong>Order ID:</strong> ${orderId.slice(0, 8).toUpperCase()}</p>
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${BASE_URL}/orders/${orderId}" class="button">View Order</a>
              </p>
            </div>
            <div class="footer">
              <p>Questions? Reply to this email for help.</p>
              <p>The ButterGolf Team</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
