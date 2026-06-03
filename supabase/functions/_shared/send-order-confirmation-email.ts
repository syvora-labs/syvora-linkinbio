import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveProductThumbnails } from './resolve-product-thumbnails.ts'

// Sends the merch-shop order confirmation via Resend. Mirrors the ticket
// confirmation (_shared/send-confirmation-email.ts) but reads from
// product_orders / product_order_items and shows shipping + delivery address.
export async function sendOrderConfirmationEmail(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  shopUrl: string,
) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured, skipping email')
    return
  }

  const { data: order } = await supabase
    .from('product_orders')
    .select('id, mandator_id, buyer_name, buyer_email, total_cents, currency, shipping_address')
    .eq('id', orderId)
    .single()

  if (!order) return

  const { data: items } = await supabase
    .from('product_order_items')
    .select('product_id, product_title_snapshot, size_snapshot, unit_price_cents, quantity, currency')
    .eq('order_id', orderId)

  const lineItems = items ?? []

  // Resolve a primary thumbnail per product (best-effort — if anything fails we
  // simply render the email without images).
  const thumbByProduct = await resolveProductThumbnails(
    supabase,
    order.mandator_id as string,
    [...new Set(lineItems.map(i => i.product_id).filter(Boolean))] as string[],
  )

  const fmt = (cents: number) => `${order.currency.toUpperCase()} ${(cents / 100).toFixed(2)}`

  const itemsTotal = lineItems.reduce((sum, i) => sum + i.unit_price_cents * i.quantity, 0)
  // Shipping isn't stored separately on the order — derive it from the
  // difference between the charged total and the line-item subtotal.
  const shippingCents = Math.max(0, order.total_cents - itemsTotal)

  const itemCount = lineItems.reduce((sum, i) => sum + i.quantity, 0)

  const itemListHtml = lineItems.map(i => {
    const thumb = thumbByProduct[i.product_id]
    const thumbCell = thumb
      ? `<img src="${thumb}" width="48" height="48" alt="" style="display: block; width: 48px; height: 48px; border-radius: 6px; object-fit: cover;">`
      : `<div style="width: 48px; height: 48px; border-radius: 6px; background: #ece9fb;"></div>`
    return `<tr>
      <td width="48" style="padding: 12px 0 12px 16px; border-bottom: 1px solid #eee; vertical-align: middle;">${thumbCell}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #eee; font-family: sans-serif; font-size: 14px; color: #333; vertical-align: middle;">${i.quantity}&times; ${i.product_title_snapshot}${i.size_snapshot ? ` &mdash; ${i.size_snapshot}` : ''}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #eee; font-family: sans-serif; font-size: 14px; color: #333; text-align: right; vertical-align: middle; font-variant-numeric: tabular-nums;">${fmt(i.unit_price_cents * i.quantity)}</td>
    </tr>`
  }).join('')

  const addr = (order.shipping_address ?? {}) as {
    line1?: string; line2?: string; postal_code?: string; city?: string; country?: string
  }
  const addressHtml = [
    order.buyer_name,
    addr.line1,
    addr.line2,
    [addr.postal_code, addr.city].filter(Boolean).join(' '),
    addr.country,
  ].filter(Boolean).join('<br>')

  const orderLink = `${shopUrl}/shop/order/${order.id}`
  const shopLink = `${shopUrl}/shop`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="500" cellpadding="0" cellspacing="0" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6C5CE7, #9684E8); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-family: sans-serif; font-size: 20px; font-weight: 800; color: white; letter-spacing: 3px; text-transform: uppercase;">ECLIPSE BOUNDARIES</h1>
            </td>
          </tr>

          <!-- Confirmation -->
          <tr>
            <td style="padding: 32px 24px 16px; text-align: center;">
              <div style="width: 48px; height: 48px; border-radius: 50%; background: #1a1a1a; color: white; font-size: 24px; line-height: 48px; margin: 0 auto 16px;">&#10003;</div>
              <h2 style="margin: 0 0 8px; font-family: sans-serif; font-size: 22px; color: #1a1a1a;">Order Confirmed</h2>
              <p style="margin: 0; font-family: sans-serif; font-size: 14px; color: #777;">Thank you for your order, ${order.buyer_name}!</p>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding: 16px 24px;">
              <h3 style="margin: 0 0 12px; font-family: sans-serif; font-size: 14px; color: #1a1a1a; letter-spacing: 1px; text-transform: uppercase;">Your Order (${itemCount})</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${itemListHtml}
                <tr>
                  <td colspan="2" style="padding: 12px 16px; font-family: sans-serif; font-size: 13px; color: #777;">Shipping</td>
                  <td style="padding: 12px 16px; font-family: sans-serif; font-size: 13px; color: #777; text-align: right;">${fmt(shippingCents)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 12px 16px; font-family: sans-serif; font-size: 14px; color: #333; font-weight: bold;">Total</td>
                  <td style="padding: 12px 16px; font-family: sans-serif; font-size: 14px; color: #333; font-weight: bold; text-align: right;">${fmt(order.total_cents)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shipping address -->
          <tr>
            <td style="padding: 8px 24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9f9f9; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px;">
                    <h3 style="margin: 0 0 8px; font-family: sans-serif; font-size: 13px; color: #1a1a1a; letter-spacing: 1px; text-transform: uppercase;">Ships to</h3>
                    <p style="margin: 0; font-family: sans-serif; font-size: 13px; color: #555; line-height: 1.5;">${addressHtml}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 24px 32px; text-align: center;">
              <a href="${orderLink}" style="display: inline-block; padding: 14px 32px; background: #1a1a1a; color: white; text-decoration: none; font-family: sans-serif; font-size: 14px; font-weight: 600; border-radius: 8px;">VIEW YOUR ORDER</a>
              <p style="margin: 16px 0 0; font-family: sans-serif; font-size: 13px;"><a href="${shopLink}" style="color: #6C5CE7; text-decoration: none;">Continue shopping</a></p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background: #fafafa; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; font-family: sans-serif; font-size: 12px; color: #999;">We'll email you again when your order ships.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'shop@eclipseboundaries.com'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `ECLIPSE BOUNDARIES <${fromEmail}>`,
      to: [order.buyer_email],
      subject: 'Your ECLIPSE BOUNDARIES order',
      html,
    }),
  })

  if (res.ok) {
    await supabase
      .from('product_orders')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', orderId)
    console.log('Order confirmation email sent to', order.buyer_email)
  } else {
    const errBody = await res.text()
    console.error('Failed to send order confirmation email:', res.status, errBody)
  }
}
