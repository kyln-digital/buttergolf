import { Resend } from "resend";
import { getBaseUrl } from "@/lib/base-url";

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

const BASE_URL = getBaseUrl();

/**
 * Escape HTML special characters to prevent XSS in email templates.
 * Applied to all user-generated strings before interpolation into HTML.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  const { buyerEmail, orderId, amountTotal } = params;
  const buyerName = escapeHtml(params.buyerName);
  const productTitle = escapeHtml(params.productTitle);
  const sellerName = escapeHtml(params.sellerName);

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
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .order-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Order Confirmed!</h1>
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
  const { sellerEmail, orderId, amountTotal, sellerPayout, shippingAddress } = params;
  const sellerName = escapeHtml(params.sellerName);
  const productTitle = escapeHtml(params.productTitle);
  const buyerName = escapeHtml(params.buyerName);

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
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .order-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .payout-box { background: #02aaa4; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
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
                <p><strong>Ship To:</strong> ${escapeHtml(shippingAddress.city)}, ${escapeHtml(shippingAddress.zip)}</p>
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
  const { buyerEmail, orderId, trackingUrl, estimatedDelivery } = params;
  const buyerName = escapeHtml(params.buyerName);
  const productTitle = escapeHtml(params.productTitle);
  const trackingCode = escapeHtml(params.trackingCode);
  const carrier = escapeHtml(params.carrier);

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
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .tracking-box { background: #3c50e0; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
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
  const { recipientEmail, orderId } = params;
  const recipientName = escapeHtml(params.recipientName);
  const senderName = escapeHtml(params.senderName);
  const productTitle = escapeHtml(params.productTitle);
  const messagePreview = escapeHtml(params.messagePreview);

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
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 20px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .message-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F45314; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
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
  const { email, orderId, isBuyer } = params;
  const name = escapeHtml(params.name);
  const productTitle = escapeHtml(params.productTitle);

  const subject = isBuyer
    ? `Your order has been delivered! ${params.productTitle}`
    : `Your sale has been delivered! ${params.productTitle}`;

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
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
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
  const { buyerEmail, orderId, estimatedDelivery } = params;
  const buyerName = escapeHtml(params.buyerName);
  const productTitle = escapeHtml(params.productTitle);
  const carrier = params.carrier ? escapeHtml(params.carrier) : null;

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
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
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
  const { buyerEmail, orderId, estimatedDelivery } = params;
  const buyerName = escapeHtml(params.buyerName);
  const productTitle = escapeHtml(params.productTitle);
  const trackingCode = params.trackingCode ? escapeHtml(params.trackingCode) : null;
  const trackingUrl = params.trackingUrl ? escapeHtml(params.trackingUrl) : null;
  const carrier = params.carrier ? escapeHtml(params.carrier) : null;
  const currentLocation = params.currentLocation ? escapeHtml(params.currentLocation) : undefined;

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
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .tracking-box { background: #3c50e0; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .location-box { background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F45314; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
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
  const { buyerEmail, orderId } = params;
  const buyerName = escapeHtml(params.buyerName);
  const productTitle = escapeHtml(params.productTitle);
  const trackingCode = params.trackingCode ? escapeHtml(params.trackingCode) : null;
  const trackingUrl = params.trackingUrl ? escapeHtml(params.trackingUrl) : null;

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: buyerEmail,
      subject: `Your package arrives TODAY! ${productTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #02aaa4; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .alert-box { background: #02aaa4; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
            .checklist { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Out for Delivery TODAY!</h1>
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
  const { buyerEmail, orderId, daysUntilRelease, autoReleaseDate, sellerPayout } = params;
  const buyerName = escapeHtml(params.buyerName);
  const productTitle = escapeHtml(params.productTitle);

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
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .alert-box { background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
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
  releaseReason: "buyer_confirmed" | "auto_released" | "admin_released";
}): Promise<EmailResult> {
  const { sellerEmail, orderId, payoutAmount, releaseReason } = params;
  const sellerName = escapeHtml(params.sellerName);
  const productTitle = escapeHtml(params.productTitle);

  const reasonText =
    releaseReason === "buyer_confirmed"
      ? "The buyer confirmed they received their item."
      : releaseReason === "admin_released"
        ? "Our support team released the payment after reviewing the order."
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
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .payout-box { background: #02aaa4; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
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
  const { buyerEmail, orderId, autoReleaseDate } = params;
  const buyerName = escapeHtml(params.buyerName);
  const productTitle = escapeHtml(params.productTitle);

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
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 24px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .protection-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3c50e0; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
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

// ============================================================================
// Offer Notification Emails
// ============================================================================

/**
 * Send new offer notification to seller
 */
export async function sendNewOfferEmail(params: {
  sellerEmail: string;
  sellerName: string;
  buyerName: string;
  offerAmount: number;
  productTitle: string;
  productPrice: number;
  conversationId: string;
}): Promise<EmailResult> {
  const { sellerEmail, conversationId } = params;
  const sellerName = escapeHtml(params.sellerName);
  const buyerName = escapeHtml(params.buyerName);
  const productTitle = escapeHtml(params.productTitle);

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: sellerEmail,
      subject: `New offer on ${productTitle} — £${params.offerAmount.toFixed(2)}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #F45314; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 20px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .offer-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F45314; text-align: center; }
            .offer-amount { font-size: 28px; font-weight: 700; color: #F45314; }
            .listed-price { font-size: 14px; color: #545454; text-decoration: line-through; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Offer Received</h1>
            </div>
            <div class="content">
              <p>Hi ${sellerName},</p>
              <p><strong>${buyerName}</strong> made an offer on <strong>${productTitle}</strong>:</p>
              
              <div class="offer-box">
                <p class="offer-amount">£${params.offerAmount.toFixed(2)}</p>
                <p class="listed-price">Listed at £${params.productPrice.toFixed(2)}</p>
              </div>
              
              <p>You can accept, decline, or counter this offer.</p>
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${BASE_URL}/messages/${conversationId}" class="button">View Offer</a>
              </p>
            </div>
            <div class="footer">
              <p>Offers expire after 7 days.</p>
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
 * Send counter-offer notification to the other party
 */
export async function sendCounterOfferEmail(params: {
  recipientEmail: string;
  recipientName: string;
  counterPartyName: string;
  counterAmount: number;
  productTitle: string;
  conversationId: string;
}): Promise<EmailResult> {
  const { recipientEmail, conversationId } = params;
  const recipientName = escapeHtml(params.recipientName);
  const counterPartyName = escapeHtml(params.counterPartyName);
  const productTitle = escapeHtml(params.productTitle);

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `Counter-offer on ${productTitle} — £${params.counterAmount.toFixed(2)}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #F45314; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 20px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .offer-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3E3B2C; text-align: center; }
            .offer-amount { font-size: 28px; font-weight: 700; color: #3E3B2C; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Counter-Offer</h1>
            </div>
            <div class="content">
              <p>Hi ${recipientName},</p>
              <p><strong>${counterPartyName}</strong> sent a counter-offer on <strong>${productTitle}</strong>:</p>
              
              <div class="offer-box">
                <p class="offer-amount">£${params.counterAmount.toFixed(2)}</p>
              </div>
              
              <p>You can accept, decline, or counter this offer.</p>
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${BASE_URL}/messages/${conversationId}" class="button">View Counter-Offer</a>
              </p>
            </div>
            <div class="footer">
              <p>Continue the conversation on ButterGolf.</p>
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
 * Send offer accepted notification to buyer (with checkout link)
 */
export async function sendOfferAcceptedEmail(params: {
  buyerEmail: string;
  buyerName: string;
  sellerName: string;
  acceptedAmount: number;
  productTitle: string;
  conversationId: string;
  offerId: string;
}): Promise<EmailResult> {
  const { buyerEmail, conversationId, offerId } = params;
  const buyerName = escapeHtml(params.buyerName);
  const sellerName = escapeHtml(params.sellerName);
  const productTitle = escapeHtml(params.productTitle);

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: buyerEmail,
      subject: `Your offer on ${productTitle} was accepted!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #02aaa4; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 20px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .offer-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #02aaa4; text-align: center; }
            .offer-amount { font-size: 28px; font-weight: 700; color: #02aaa4; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 14px 32px; text-decoration: none; border-radius: 24px; font-weight: 600; font-size: 16px; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Offer Accepted!</h1>
            </div>
            <div class="content">
              <p>Hi ${buyerName},</p>
              <p>Great news! <strong>${sellerName}</strong> accepted your offer on <strong>${productTitle}</strong>.</p>
              
              <div class="offer-box">
                <p class="offer-amount">£${params.acceptedAmount.toFixed(2)}</p>
                <p style="margin: 8px 0 0; color: #545454;">Agreed price</p>
              </div>
              
              <p>Complete your purchase to secure the item.</p>
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${BASE_URL}/checkout?offerId=${offerId}" class="button">Complete Purchase</a>
              </p>
              
              <p style="text-align: center; margin-top: 12px;">
                <a href="${BASE_URL}/messages/${conversationId}" style="color: #545454;">Or view conversation</a>
              </p>
            </div>
            <div class="footer">
              <p>Complete your purchase soon — accepted offers don't last forever.</p>
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
 * Send offer rejected notification to buyer
 */
export async function sendOfferRejectedEmail(params: {
  buyerEmail: string;
  buyerName: string;
  sellerName: string;
  offerAmount: number;
  productTitle: string;
  conversationId: string;
}): Promise<EmailResult> {
  const { buyerEmail, conversationId } = params;
  const buyerName = escapeHtml(params.buyerName);
  const sellerName = escapeHtml(params.sellerName);
  const productTitle = escapeHtml(params.productTitle);

  try {
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: buyerEmail,
      subject: `Offer update on ${productTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3E3B2C; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 20px; }
            .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Offer Declined</h1>
            </div>
            <div class="content">
              <p>Hi ${buyerName},</p>
              <p><strong>${sellerName}</strong> declined your offer of <strong>£${params.offerAmount.toFixed(2)}</strong> on <strong>${productTitle}</strong>.</p>
              
              <p>You can send a new offer or continue the conversation.</p>
              
              <p style="text-align: center; margin-top: 30px;">
                <a href="${BASE_URL}/messages/${conversationId}" class="button">View Conversation</a>
              </p>
            </div>
            <div class="footer">
              <p>Keep browsing on ButterGolf for more finds.</p>
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

// ─── Admin portal & order issues ─────────────────────────────────────────────

/**
 * Shared shell for the admin-era emails below. Same look as the templates
 * above, without repeating 40 lines of CSS per message.
 */
function renderEmailShell(params: {
  title: string;
  headerColor: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
  footer?: string;
}): string {
  const { title, headerColor, bodyHtml, cta, footer } = params;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #323232; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${headerColor}; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; margin: 0; font-size: 24px; }
        .content { background: #FFFAD2; padding: 30px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .quote { background: white; padding: 16px 20px; border-left: 4px solid #3E3B2C; border-radius: 8px; margin: 20px 0; white-space: pre-wrap; }
        .button { display: inline-block; background: #F45314; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: 600; }
        .footer { text-align: center; padding: 20px; color: #545454; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>${escapeHtml(title)}</h1></div>
        <div class="content">
          ${bodyHtml}
          ${cta ? `<p style="text-align: center; margin-top: 30px;"><a href="${cta.href}" class="button">${escapeHtml(cta.label)}</a></p>` : ""}
        </div>
        <div class="footer"><p>${escapeHtml(footer ?? "ButterGolf")}</p></div>
      </div>
    </body>
    </html>
  `;
}

function shortOrderId(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

/**
 * Alert the staff inbox (ADMIN_NOTIFICATION_EMAIL). Silently a no-op when the
 * variable is unset so nothing that calls this can fail for want of an inbox.
 */
export async function sendStaffAlertEmail(params: {
  subject: string;
  /** Plain-text facts, one per line. Escaped here. */
  lines: string[];
  /** Admin-portal path to open, e.g. "/admin/orders/abc". */
  path?: string;
}): Promise<EmailResult> {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (!to) {
    console.info("[Email] ADMIN_NOTIFICATION_EMAIL not set; skipping staff alert:", params.subject);
    return { success: false, error: "ADMIN_NOTIFICATION_EMAIL not configured" };
  }

  const html = renderEmailShell({
    title: params.subject,
    headerColor: "#3E3B2C",
    bodyHtml: `<div class="info-box">${params.lines
      .map((line) => `<p style="margin: 4px 0;">${escapeHtml(line)}</p>`)
      .join("")}</div>`,
    cta: params.path ? { label: "Open in admin", href: `${BASE_URL}${params.path}` } : undefined,
    footer: "ButterGolf staff alert",
  });

  return sendEmail({ to, subject: `[ButterGolf admin] ${params.subject}`, html });
}

/**
 * Tell the seller a buyer has raised a problem and their payout is on hold
 * until it is resolved.
 */
export async function sendOrderIssueOpenedEmail(params: {
  sellerEmail: string;
  sellerName: string;
  buyerName: string;
  orderId: string;
  productTitle: string;
  reasonLabel: string;
  description: string;
}): Promise<EmailResult> {
  const { sellerEmail, orderId } = params;
  const html = renderEmailShell({
    title: "A buyer has reported a problem",
    headerColor: "#F45314",
    bodyHtml: `
      <p>Hi ${escapeHtml(params.sellerName)},</p>
      <p>${escapeHtml(params.buyerName)} has reported a problem with their order for <strong>${escapeHtml(params.productTitle)}</strong>. Your payout for this order is on hold while we look into it.</p>
      <div class="info-box">
        <p><strong>Order ID:</strong> ${shortOrderId(orderId)}</p>
        <p><strong>Reason:</strong> ${escapeHtml(params.reasonLabel)}</p>
      </div>
      <div class="quote">${escapeHtml(params.description)}</div>
      <p>You can reply to the buyer in your order conversation. Our team will review the case and let you both know the outcome.</p>
    `,
    cta: { label: "View order", href: `${BASE_URL}/orders/${orderId}` },
    footer: "Most problems are sorted out quickly between buyer and seller.",
  });

  return sendEmail({
    to: sellerEmail,
    subject: `Problem reported on order ${shortOrderId(orderId)}`,
    html,
  });
}

/**
 * Outcome of a reported problem, sent to buyer and seller separately with
 * wording for their side of it.
 */
export async function sendOrderIssueResolvedEmail(params: {
  to: string;
  name: string;
  role: "buyer" | "seller";
  orderId: string;
  productTitle: string;
  resolution: "REFUNDED" | "RELEASED" | "DISMISSED";
  /** RELEASED but the seller hasn't finished payout setup: the transfer waits for that. */
  parked?: boolean;
  note?: string | null;
}): Promise<EmailResult> {
  const { orderId, resolution, role, parked } = params;

  const outcome: Record<typeof resolution, { buyer: string; seller: string }> = {
    REFUNDED: {
      buyer:
        "We've refunded your payment. It will show on your original payment method within 5-10 working days.",
      seller:
        "We've refunded the buyer for this order. No payout will be made for it. If you believe this is wrong, reply to this email.",
    },
    RELEASED: {
      buyer: parked
        ? "After reviewing the case we've decided in the seller's favour. The payment will be released to them once they complete their payout setup. If you have new information, reply to this email."
        : "After reviewing the case we've released the payment to the seller. If you have new information, reply to this email.",
      seller: parked
        ? "After reviewing the case we've decided in your favour. Your payout will be released as soon as you complete payout setup in your seller settings."
        : "After reviewing the case we've released your payout. It's on its way to your bank.",
    },
    DISMISSED: {
      buyer:
        "After reviewing the case we've closed this report without taking action. The order continues as normal.",
      seller:
        "After reviewing the case we've closed this report. Your payout is no longer on hold.",
    },
  };

  const html = renderEmailShell({
    title: "Update on your reported problem",
    headerColor: resolution === "REFUNDED" ? "#02aaa4" : "#3E3B2C",
    bodyHtml: `
      <p>Hi ${escapeHtml(params.name)},</p>
      <p>${escapeHtml(outcome[resolution][role])}</p>
      <div class="info-box">
        <p><strong>Item:</strong> ${escapeHtml(params.productTitle)}</p>
        <p><strong>Order ID:</strong> ${shortOrderId(orderId)}</p>
      </div>
      ${params.note ? `<p><strong>Note from our team:</strong></p><div class="quote">${escapeHtml(params.note)}</div>` : ""}
    `,
    cta: { label: "View order", href: `${BASE_URL}/orders/${orderId}` },
  });

  return sendEmail({
    to: params.to,
    subject: `Order ${shortOrderId(orderId)}: your reported problem has been resolved`,
    html,
  });
}

/**
 * Suspension or reinstatement notice.
 */
export async function sendAccountSuspensionEmail(params: {
  email: string;
  name: string;
  suspended: boolean;
  reason?: string | null;
}): Promise<EmailResult> {
  const html = params.suspended
    ? renderEmailShell({
        title: "Your ButterGolf account has been suspended",
        headerColor: "#3E3B2C",
        bodyHtml: `
          <p>Hi ${escapeHtml(params.name)},</p>
          <p>We've suspended your account. You can still sign in and view your orders, but you can't list, buy, message or make offers while the suspension is in place. Your listings are hidden.</p>
          ${params.reason ? `<div class="quote">${escapeHtml(params.reason)}</div>` : ""}
          <p>If you think this is a mistake, reply to this email or contact support@buttergolf.com.</p>
        `,
      })
    : renderEmailShell({
        title: "Your ButterGolf account is active again",
        headerColor: "#02aaa4",
        bodyHtml: `
          <p>Hi ${escapeHtml(params.name)},</p>
          <p>The suspension on your account has been lifted. Your listings are visible again and you can buy, sell and message as normal.</p>
        `,
        cta: { label: "Go to ButterGolf", href: BASE_URL },
      });

  return sendEmail({
    to: params.email,
    subject: params.suspended
      ? "Your ButterGolf account has been suspended"
      : "Your ButterGolf account is active again",
    html,
  });
}
