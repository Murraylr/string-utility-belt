const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64')
const ACCT = '111122223333' // AWS documentation example account id
const rec = (pk, seq, payload, t) => ({
  kinesis: { kinesisSchemaVersion: '1.0', partitionKey: pk, sequenceNumber: seq, data: b64(payload), approximateArrivalTimestamp: t },
  eventSource: 'aws:kinesis', eventVersion: '1.0', eventID: `shardId-000000000000:${seq}`, eventName: 'aws:kinesis:record',
  invokeIdentityArn: `arn:aws:iam::${ACCT}:role/orders-consumer`, awsRegion: 'us-east-1', eventSourceARN: `arn:aws:kinesis:us-east-1:${ACCT}:stream/orders`,
})
const kinesis = { Records: [
  rec('order-48213', '49656843311458374402180126384503215930491052114577571842', { type: 'order.created', order_id: 48213, total: 4999, currency: 'usd' }, 1790848800.123),
  rec('order-48214', '49656843311458374402180126384504424856310666743752278018', { type: 'order.paid', order_id: 48214, total: 1250, currency: 'usd', paid_via: 'card' }, 1790848801.456),
] }
const firehose = {
  invocationId: '6f1c2b0a-8d3e-4b7a-9c5d-2e4f6a8b0c1d',
  deliveryStreamArn: `arn:aws:firehose:us-east-1:${ACCT}:deliverystream/api-access-logs`,
  region: 'us-east-1',
  records: [
    { recordId: '49656843311458374402180126384505633782130281372926984194000000000000', approximateArrivalTimestamp: 1790935200412, data: b64({ ts: '2026-10-02T10:00:00.212Z', method: 'GET', path: '/v1/orders', status: 200, ms: 18, client_ip: '203.0.113.24' }) + '' },
    { recordId: '49656843311458374402180126384506842707949895970101690370000000000000', approximateArrivalTimestamp: 1790935200987, data: b64({ ts: '2026-10-02T10:00:00.871Z', method: 'POST', path: '/v1/orders', status: 422, ms: 41, client_ip: '198.51.100.7', error: 'currency "usdd" is not supported' }) },
    { recordId: '49656843311458374402180126384508051633769510599276396546000000000000', approximateArrivalTimestamp: 1790935201544, data: b64({ ts: '2026-10-02T10:00:01.409Z', method: 'GET', path: '/v1/orders/48214', status: 404, ms: 6, client_ip: '192.0.2.55' }) },
  ],
}
const pubsub = {
  message: {
    attributes: { eventType: 'invoice.paid' },
    data: b64({ invoice: 'INV-2026-0042', customer: 'cus_1042', amount_due: 0, status: 'paid', note: 'Paid in full — thank you ✓' }),
    messageId: '13687025468392',
    publishTime: '2026-10-03T08:15:00.123Z',
  },
  subscription: 'projects/example-project/subscriptions/billing-events-push',
}
for (const s of [kinesis, firehose, pubsub]) console.log(JSON.stringify(JSON.stringify(s, null, 2) + '\n'))
