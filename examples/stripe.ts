import { StripeGateway } from '../src/gateways/stripe/index.js';

async function main() {
  const gateway = new StripeGateway();
  gateway.initialize({
    secretKey: 'sk_test_placeholder',
    debug: false,
  });

  const response = await gateway.createPayment({
    amount: 2000,
    currency: 'usd',
    referenceId: 'order-123',
    description: 'Test payment',
    paymentMethod: 'card',
  });

  console.log('Stripe response:', response.transactionId, response.status);
}

main().catch(console.error);
