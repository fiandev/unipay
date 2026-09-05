import { XenditGateway } from '../src/gateways/xendit/index.js';

async function main() {
  const gateway = new XenditGateway();
  gateway.initialize({
    secretApiKey: 'xnd_placeholder',
    debug: false,
  });

  const response = await gateway.createPayment({
    amount: 50000,
    currency: 'IDR',
    referenceId: 'xendit-order-456',
    paymentMethod: 'ewallet',
    country: 'ID',
  });

  console.log('Xendit response:', response.transactionId, response.status);
}

main().catch(console.error);
