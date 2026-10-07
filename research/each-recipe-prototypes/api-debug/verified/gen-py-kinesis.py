import base64, json
def b64(o): return base64.b64encode(json.dumps(o, separators=(',', ':'), ensure_ascii=False).encode()).decode()
ACCT = '111122223333'
def rec(pk, seq, payload, t):
    return {'kinesis': {'kinesisSchemaVersion': '1.0', 'partitionKey': pk, 'sequenceNumber': seq, 'data': b64(payload), 'approximateArrivalTimestamp': t},
            'eventSource': 'aws:kinesis', 'eventVersion': '1.0', 'eventID': f'shardId-000000000001:{seq}', 'eventName': 'aws:kinesis:record',
            'invokeIdentityArn': f'arn:aws:iam::{ACCT}:role/shipping-consumer', 'awsRegion': 'eu-west-1',
            'eventSourceARN': f'arn:aws:kinesis:eu-west-1:{ACCT}:stream/shipments'}
ev = {'Records': [
    rec('shipment-7710', '49656843311458374402180126384509260559589125228451102722', {'type': 'shipment.dispatched', 'shipment_id': 7710, 'carrier': 'DHL', 'eta': '2026-10-05'}, 1791021600.25),
    rec('shipment-7711', '49656843311458374402180126384510469485408739857625808898', {'type': 'shipment.delayed', 'shipment_id': 7711, 'reason': 'Zollabfertigung – customs hold', 'retry': True}, 1791021661.5),
]}
# what a Python Lambda logs with print(event): the dict's repr, after the START line and a timestamped prefix-less line
print(json.dumps("START RequestId: 0b6e7c52-2f4a-4c1e-9d3b-8a5f1e2c7d90 Version: $LATEST\n" + repr(ev) + "\nEND RequestId: 0b6e7c52-2f4a-4c1e-9d3b-8a5f1e2c7d90\n"))
