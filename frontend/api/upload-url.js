// Vercel serverless function. Holds the Pinata JWT; hands the browser a 60-second upload link.
// The private JWT never reaches the browser.
import { PinataSDK } from 'pinata';

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const url = await pinata.upload.public.createSignedURL({
      expires: 60,
      mimeTypes: ['image/*'],
      maxFileSize: 5000000,
    });
    res.status(200).json({ url });
  } catch (e) {
    res.status(500).json({ error: 'could not create upload url', message: e?.message || String(e) });
  }
}
