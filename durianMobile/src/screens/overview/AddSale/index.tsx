import { useRoute, type RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/types';

import { PaymentForm } from './PaymentForm';
import { SaleForm } from './SaleForm';

/** SC-09: one modal for a sale and for its payments. `paymentKind` / `paymentId` pick the payment form. */
export function AddSale() {
  const params = useRoute<RouteProp<RootStackParamList, 'AddSale'>>().params;
  return params?.saleId && (params.paymentId || params.paymentKind) ? (
    <PaymentForm
      saleId={params.saleId}
      paymentId={params.paymentId}
      initialKind={params.paymentKind}
    />
  ) : (
    <SaleForm saleId={params?.saleId} />
  );
}
