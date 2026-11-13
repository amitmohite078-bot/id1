import QRCode from 'qrcode';

export interface SalonQrResult {
  bookingUrl: string;
  qrDataUrl: string; // Base64 data:image/png
  qrSvg: string;     // Raw SVG string for printing / vector scaling
  salonSlug: string;
  salonName: string;
}

export async function generateSalonQr(
  salon: { slug: string; name: string },
  customerWebUrl: string,
): Promise<SalonQrResult> {
  const cleanBase = customerWebUrl.replace(/\/+$/, '');
  const bookingUrl = `${cleanBase}/salon/${salon.slug}`;

  // High error-correction level ('H') so salon logo or counter wear-and-tear doesn't prevent scan
  const qrDataUrl = await QRCode.toDataURL(bookingUrl, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    margin: 2,
    scale: 8,
    color: {
      dark: '#18181b', // Zinc-900 for crisp scanning
      light: '#ffffff',
    },
  });

  const qrSvg = await QRCode.toString(bookingUrl, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#18181b',
      light: '#ffffff',
    },
  });

  return {
    bookingUrl,
    qrDataUrl,
    qrSvg,
    salonSlug: salon.slug,
    salonName: salon.name,
  };
}
