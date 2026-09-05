import { MidtransGateway } from '../src/gateways/midtrans/index.js';

async function main() {
  const gateway = new MidtransGateway();
  gateway.initialize({
    serverKey: 'SB-Mid-server-placeholder',
    clientKey: 'SB-Mid-client-placeholder',
    isProduction: false,
    debug: false,
  });

  const response = await gateway.createPayment({
    amount: 100000,
    currency: 'IDR',
    referenceId: 'midtrans-order-789',
    paymentMethod: 'bank_transfer',
    bank: 'bca',
  });

  console.log('Midtrans response:', response.transactionId, response.status);
}

main().catch(console.error);
