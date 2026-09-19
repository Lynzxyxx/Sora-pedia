// Provider layanan SMM (format API standar panel SMM v2). Opsional.
export function configured() {
  return !!(process.env.PROVIDER_API_URL && process.env.PROVIDER_API_KEY);
}

async function call(params) {
  const res = await fetch(process.env.PROVIDER_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ key: process.env.PROVIDER_API_KEY, ...params })
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { throw new Error('Respons provider tidak valid'); }
}

export const add = (service, link, quantity) => call({ action: 'add', service: String(service), link, quantity: String(quantity) });
export const status = (order) => call({ action: 'status', order: String(order) });
export const services = () => call({ action: 'services' });
