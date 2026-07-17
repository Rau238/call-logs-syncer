export const environment = {
  production: false,
  // ngrok tunnel → local API on port 3000
  apiUrl: 'https://ninth-rebalance-deny.ngrok-free.dev/api/v1',
  /** Max age of call logs to import and upload (days). Older history is ignored. */
  syncWindowDays: 7,
};
