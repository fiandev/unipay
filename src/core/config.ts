/**
 * unipay-sdk - Universal TypeScript SDK for popular payment gateways
 * Copyright (c) 2026 Aditia Akbar Putra A
 *
 * Licensed under the MIT License.
 */

import { z } from 'zod';

export const StripeConfigSchema = z.object({
  secretKey: z.string().min(1, 'Stripe secret key is required'),
  publishableKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  debug: z.boolean().optional().default(false),
});

export const XenditConfigSchema = z.object({
  secretApiKey: z.string().min(1, 'Xendit secret API key is required'),
  webhookVerificationToken: z.string().optional(),
  debug: z.boolean().optional().default(false),
});

export const MidtransConfigSchema = z.object({
  serverKey: z.string().min(1, 'Midtrans server key is required'),
  clientKey: z.string().optional(),
  isProduction: z.boolean().optional().default(false),
  debug: z.boolean().optional().default(false),
});

export const DokuConfigSchema = z.object({
  clientId: z.string().min(1, 'Doku client ID is required'),
  secretKey: z.string().min(1, 'Doku secret key is required'),
  privateKey: z.string().min(1, 'Doku private key is required'),
  isProduction: z.boolean().optional().default(false),
  debug: z.boolean().optional().default(false),
});

export type StripeConfig = z.infer<typeof StripeConfigSchema>;
export type XenditConfig = z.infer<typeof XenditConfigSchema>;
export type MidtransConfig = z.infer<typeof MidtransConfigSchema>;
export type DokuConfig = z.infer<typeof DokuConfigSchema>;

export const GatewayConfigMap = {
  stripe: StripeConfigSchema,
  xendit: XenditConfigSchema,
  midtrans: MidtransConfigSchema,
  doku: DokuConfigSchema,
} as const;

export interface GatewayConfig {
  stripe: StripeConfig;
  xendit: XenditConfig;
  midtrans: MidtransConfig;
  doku: DokuConfig;
}
