/** Standard envelope for users, payments, promos admin APIs */
export interface ApiEnvelope<T> {
  status: 'success' | 'error';
  message: string;
  data: T;
}
