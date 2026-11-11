export type WhatsAppDelivery = "sent" | "not_configured" | "failed";

export async function sendBookingWhatsApp(input: {
  phone: string;
  bookingId: string;
  chargerName: string;
  date: string;
  start: string;
  end: string;
  total: number;
  status: string;
}): Promise<WhatsAppDelivery> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_BOOKING_TEMPLATE;
  if (!accessToken || !phoneNumberId || !templateName) return "not_configured";

  const digits = input.phone.replace(/\D/g, "");
  const recipient = digits.length === 10 ? `91${digits}` : digits;
  if (recipient.length < 10) return "failed";

  const apiVersion = process.env.WHATSAPP_API_VERSION || "v22.0";
  const body = [
    `Booking ${input.bookingId}`,
    `${input.chargerName} on ${input.date}, ${input.start}-${input.end}`,
    `Estimate: Rs ${input.total}. Status: ${input.status}.`,
  ].join(" | ");

  try {
    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: templateName,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en" },
          components: [{ type: "body", parameters: [{ type: "text", text: body }] }],
        },
      }),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}