import type { Recipe } from '../types'
import { branch, laneStep, step } from '../define'

/*
 * Sample releases, encoded the way Helm 3's storage drivers write them: the release
 * as JSON, gzipped, then Base64. The Secret driver's value is Base64-encoded once more
 * by the Kubernetes API; the ConfigMap driver's is not.
 */
const BILLING_API =
  'SDRzSUFBQUFBQUFDLzRWVWJXK2pPQkQrSzRqOTJsQU1wZG53TGNsdVhyWnBxellwQkk3VHlSZ0gzQmlEc0VsTHF2NzNzMG5ESnJm'
  + 'ZFcwdEkrSm1aWjU2eFoveW1NNWhqM2RWalFpbGhhUStXUkwvUUNkc1V1dnVtYjBqRnhUOEpMbW5SNEVTNldhWjEzVE8vOWt4ckJV'
  + 'd1hYTGtPTUFENGFwbFhvUXlqOEJOdllQWk1zQUxYN3BYbG1uM0RjZXdCNkN2dkJGTXNXcjkydzFGRlNrRUtKb0duTXExZ2dqVlU1'
  + 'S1Z5a2c1Y1FGRnphZXY0M3k5MGxNRktLS0U1RmpDQkFxci9UeXZhNFlvZnVFMWpZTmdTa2JqWGdUdXJSY3FmaUdXQUt3TklWRFNs'
  + 'b3BOR1NoQnNCY3JNdEVCYjNXVTFwZElEUzVWUVlLbnVyeTU5QjE0ZUJPZVlDYU9CT1ZYRnRrcjFZRDBxdmR4cmtFVjM4WE9SeXYw'
  + 'TGFnYlc3VU5aUWQvWjNwUFI5M0E5NHJGTlJlZzc1amdITkpsT3RzSDZNYnRQaTNRK2RiTFlmN3FlejBSL1BuYVdvZjlLZy9VZFhX'
  + 'eGJQTjJzelJ0a2oyaXdMMjdtNDFHanVLQi9sNkY5a1dLYnB3c2FadkhNbzZoeE90dUROUUF4ZTJoalpjeSs1YlFmZCtoWmNReGxU'
  + 'cEFsMDd0aU5aMFFhZHUzT2hRK0htVm9OdnhmTGRMSERIM3dFazhuWnJqcStNNXJPbkR4d1A5QjQ5bnQ5WmdNUDdCaGV6N3lUUHE0'
  + 'R2RaUHVjZERmN0lQbDg1OTRBTTZuNEhCd1hlMFIxUHYrWVRyT2JZY00vQnBIYTUvbk9oVm41bkcrVVJJTFlxN1BNMGw0OHJZbnpC'
  + 'bG03TzJKai93WDBHNHZxMmhEN0xRZXFwUjdyM0U5bDJaVEFjTlhvNEdtMVhaYXZQeUNVOThiNy9JcVFqOGhDN1lZeFkyMHI2YzMr'
  + 'anZmOHRtaExSVzNmS21reHltV1AxVXVDdzRFVVhWeU1hb2NFcTRxQm9EdjBJMUFJYWNnOHZ6ZmhZd1BUU3BiWmlxSDJXOGFzOXhV'
  + 'VE01RUVBaUhHVTRoOGNlM1JDcU1xcU5tcHVDYlVoNkpxQWpWRjMvQzZFdGtSd3lzc0ZjN3ZSZXJ4ZXhMOXF5cUN1RVhlMUUydVZ2'
  + 'K3o1aVB5Zk8xZVE0OGNzZGlOaVdzTVRWdm5XK0VUdk9zaHN4VFZQVGRKWWdZcnpFcUxWOVNPU3VacXN0bCs4SmtpZlkyalF0aHdK'
  + 'bEN4aGp5ajhRVFdYOUQ1bW1IUVVmdzA2enEwWFBLVDRua2RtUHF0U1M1eXNnWWJMWWs3amVSekZkeUdHMU4rQnEwUjl2M1QxY1Rx'
  + 'Ukg3UFJCNjErMFR3NHZJVkx2VGduYlkrVDYrNzhFL1RBbjNBVUFBQT09'

const REPORT_EXPORT =
  'SDRzSUFBQUFBQUFDLzRWVVczT3JOaEQrS3d4OTY4UTJsemlwZVl2ZDQwdVNrOVNYZ09Gd3BpT0VqQlVMaVVIQ01jbmt2M2RGWWg4'
  + 'N1NWc3hER2ozMCs2M3E5MTlNVG5LaWVtWkpTbEVxVnBrcHovbW1VbjVTcGplaTdtaXBWUi9wNlJnb2lZcEFCM0x1V2hadlpaOXZy'
  + 'RCs4Q3pYczUzMnVlVjB1M1lFeHhqNkd1MzBGdGFsMSsxNjUxYmJzbnZ1aGFQUktXRkVOYmhtSTNGSkMwVUZCOEZEa1pVb0pRWVdl'
  + 'YUZCQUpBS3FVcUM3bUQvOWN6RWF3UjhnV2hPRkVxUlF2ci9YMkxha2xLK1diZmJUdHNDQ1Nxb2Z4QnVuVVpTK0o5Z3FpNjBQZEF4'
  + 'aWxIREVGd3pnVGVteHl2R0FFR0FKbElFNlAwNCtEOElPN2dVL0ZFazdScmxUSWZhOERURFpiL3djNy9HRHRzbWp5SUw4NkVWT3Rr'
  + 'MmZmeDJneHhXUlgrS2JPcGViNU5Oc1EyelFrWEwyVG9hQVdZaGJpYURmaFVHTnJ1bi9VdFNYMVVQdVMrallQZ2N6YnYzV2o0WjI3'
  + 'MEJ2M3VLZ3U4WEEzcVZZZWRPUk1ITVRrWVBGNU94dXB3TXVrRVk3T3hvK2IwNjBtV3JRWCtYQmowcm12ZDdxNm5JSmlQd3pXWXNX'
  + 'ZlpsdUp5eCt3eGtBN0RuOWxuNHJIbGNOZnQwNUNzODJxMVRzSy85N2VVZmNjMDd2bWJZbmEweG4wMFRaMWVFN3VaaThxMVh6Zkpo'
  + 'a1l6OU9wcUs3QmdmT3IwcUhZRk81K3FqTFhodjU0ZGNNREx1YnpHZmZzSkF2b29rR1BKb0FiYjVhZndvc05lUjgxRGgzSDlLM0xz'
  + 'aUhmVnFvdU5mRkUxdS9Yd28wOEIvdnMyWkNvT1UzWEs0aHhyMDg4bFhmdFk0VDUrQlN6S2hsZ3E1LzRnYzM1clFwNHk0TXJ0bDBS'
  + 'cGlaTGp1MGpTNEs2UGw5RFRudm5WanZ2NkVZa1dzMHVYMFlpWVYzaEQxMWlRMFJ4blJRbDNia2lwUjFrMmhaMVNxc202VEhkTHQw'
  + 'b2F1Nlh5c2ZvV3lRMGxEOVVxOEptbkZkSjFhaG12OHJwKzlQRWY3dWw1UnBrbm9qVzQyd1ZjME8rRWtYYS96N2tvZTNJc3k2NlNJ'
  + 'c3RvODhlTmFodlBMVVk0NFhSR3BqYlJhclpqL1pzeEZWV0xpR1NmTU8xOTNVY3gvOWE1bkpFamhkV2RyeDN4RGVlb1pBMEJlaXlU'
  + 'bSs2bmd4ZHd3ZEZ0K3NCNXpXUkRjYVBkRVBTTStZaHFiV2dkZUYrODBHaXlnOThmMFVxZTZUM3E5U2dnVlJ0VmZBa1pJN1JuM2ZB'
  + 'Z0pxa3B5aklIOEtrUTVSSFZ5MURCYTc5ejNwSTJUMVJTRnB2My9kZUExOS84VzFQRkNaU1k5NDBjTVYvRjJ0YkY1QmdiLyszWmo4'
  + 'MmZNaitlcWM5YU1QbGtnM014TGpsaXRLSmJtNno4Y2hRU2FhQVlBQUE9PQ=='

const SESSION_CACHE =
  'H4sIAAAAAAAC/51Wa3OiShD9KxT3a1QeUVe+qYkmvrJRI8K6dWsYRkRngIKBRHP3v98efKFJdm9dqqhyuntOnz7T9PguB4gR2ZAT'
  + 'kiR+GJQwwisi38h+sAxl411e+nHC/3ZJRMMtcSFQU7RaSamXNHWq6oauGEq1XK+rSkO3YRtFn0U3SroyVVVD1Yzbb2XtVqmpdRHt'
  + 'Ekp4HpcvEhz7EQcWYHiJvBi5RMIhi0QQBCQc8TQB3wn/142MVyjmgigjHLmII/H7i5oyEid7dKV8W1bBgiJ/djJmWm6JzpZ6WStX'
  + 'wci3kcADH/UxyhlCahrijWwEKaUQQYAm4gTo/TjlPxkrOAyWvsdQVN4iRkWxOVPZmreiGZttsUYzZx167vq+jzSa2neh96w1UpvR'
  + 'YGp2XttMpW63s7Hm49WTF3qP3erKMV9qjw+8/tiuTmzzjVrzER1scru3nCvcOuxvs/HK7d7X2n7Tw2y2QfNhmvsg37IJWO2m55id'
  + 'W8eccUfvVQ+YpmW+qTbEXvrUhsB5bLe4NV9x21QzHGw47jYSZI4+7LXndmTp48jRqs+O9ga/N4JbH+T7RKX9uTIS8D/IBOtXvG1o'
  + 'w+coRmZ18+S37u15K3F0CpSqyv+Qq4/1FrV2YR9K2+V+fZzhtVhDuV0VJByF027HB98ux2znMqzwQ/O3uBCjgEyvTrej2NMT3iW/'
  + 'PVZimT3qPAxre4n3r6gV6quTbTN9YbPENjs7e1J9skyVFo5jh7uzdQFrDZIrlgmtNO8V+IpX8RzW4cDl2A79s09wo9wyXfrkN/2D'
  + 'v0b0xBtsRqE17ymDTecVd2yKgxEc662o0S/yzTVh7g44O49+A+ocZgec7KL9/J57tU+DFlGh1UaOPkvdKx2uuZ/a+0OMaOeG6gTj'
  + 'Z9A3hDoyez5eD/Qetbt0d4p/sDPnYcahTS/yDCatVGgL/IWGDJn4Sp9R5jA7shV1he/C/ofcB365ZhTOsztbYe0lnQr7pNVYTtQT'
  + 'rvzrJ0wlRFMxN95lkvlYDJfvIYyZLfR9EB5N8C0w9MYIC2PhULVvzBEzKIHJxtBxCi19KpDEQozGfOh8Cowo3ZBtUqJxeoWsVWt7'
  + 'ZIYCf0kSmK1yqVRaBH9JkzCNMTGki7Fa+WrILYLzcDWkTF0EGz9wDamdRw1RtAiOI9tYBJIkpsEVdmmPuAhOQTFx/aQszIb0jzBI'
  + '0om8lFO/MpaivGSpUPAi+I/1XI2jy4LgLkgq56ruTrF/LmsRJBHBuTeBCxDzMDaOtDleDZBDaHKwSCLRh/2SdGR53FhMKR56CfIV'
  + 'DDA4UhEPCMuRH0CNhZ2lQw259mezJPkMeWBfyLnHyC/LhVyMQLGXGNKPhVwhHFfysMr5CBfyz2JwFtKUkWGYBryYvkjh2A/SxcPE'
  + 'lu+IrwzpnOcYtEf9rJ6PYPjYmlfpf9eaxb8V+k1+pyURwuJieyXwIf0LtAYf2GEJAAA='

const STATUS_PAGE =
  'SDRzSUFBQUFBQUFDLzVWVWJXK2JNQkQrSzRoOWJWSWdTN3J3TGNtV2x6WnQxYWFGd0pnbVl4eHdZd3pDSmkycCt0OTNkcG8wbmJw'
  + 'TnM0U0VuN3Q3N2puN3pzOG1Semt4WFZOSUpHdlJLbEZLekJPVDhsVmh1cy9taWxaQy9reEl5WXFHSk9EbVdFNnZaVnN0cTNkbjlW'
  + 'M0hkanVmMjcyZVpUdGZRZ2hqNkgrOEU4S0kxSDU2STNCRlMwa0xEc0NNZ3g3R0RGemtwWElDaDUxQXNCMzRYMDVNbktGS0txRTVr'
  + 'U2hCRXFuL0R5dmFrRXJzdUsyMjNiWUFRU1gxRHVERzBVajVoblRhVmx1QnNpa1ZHOWdZeFVqcmc4U3N3R3ZUNVRWajRFRkFKSklF'
  + 'eEgwL1pEK0FwenU5T2VHeTNhQ2NxVnExVUROWURrc3Y5eHJzc0UzOFVLU3dmOFJOMzdtOEtTdmtkOWZYZFBndFhBNUYzR0V5OUx2'
  + 'V0tMZFpNaG12ZytWdGRwMFc2V3pTeldML3ZqZWJ5clBacUxzSS9TY1dMSy9ZZkszeGRMVzBMbkJueUlKdGNURWJEUnZGaGZ5ckRH'
  + 'K0xsSFJFT21kaEZrODlocHZ1d1hiajlPMlkzK2hZaU5scXpzN3RCajhvamdIa3RMTmtjbFhjVGNZVWJGdXRRK0dqWVlhbmc3OXFB'
  + 'UjhyOU8zSGVESzJ3cnNEMy91YWRsd2k4TTlaUEwzc2plamdGUnZvODRFek9TUE5vTDdQUFJINjQyMjQ2RjRIdnMxbVU3dS84eDF1'
  + 'OGNSN09PSjZpSjJ1RmZpc0RwZm5SM3JWWjZWeFBwYWdKVTBjang3bmdyZ3k5c2RjMldaYzErUUgvcE1kTGk5cjVOdFo2TnpYT1Bj'
  + 'ZTQ4NVZtVXo2RFZrTSs2dTdVbXZ6OHJGSWZHODd6NWtNL0lUTitXMFdObUJmekM3TWx4L1FpNGpWcWx1ZVRacXI3b1NmaXBTRm9M'
  + 'S29HbWlNaXFSVXlLcHBreWVrK3I4TlkzRDZ2cDBsU2c4OUN1MEk0YW83UjBYTllSeHNRQVRPU0k3MkxicWlUQ1ZVRzdEbGlOTVZF'
  + 'ZUJwdGxxdGlIOHlGa1ZkWWVJYVIwbE8vOWpCRVg4YkhkZUF3UkNuR3p2aWE4b1QxL2g2OEkzNGZpamRpQnVHbW90M0NTSXVTb0sx'
  + 'N1ZXK2NBMWJiUVU4REJqT1F0c01JMGNTWjNNVUV5WmVFVU5sL1kzTU1QYUM5MkhIMmRWaTd5aytKb0hzZTFWcTRZSkxSRGtVZXhU'
  + 'WGVpM21rY1J2b0dIb3kzU042Si8zNStwN2k4eUlIejlNOW9sK08wU0pzSHBBaWxLWUw3OEF4Q1pvK3A4RkFBQT0='

/** Steps 1 and 2 run only on a pasted Secret or ConfigMap (YAML or JSON), not on a bare value. */
const HAS_RELEASE_KEY = { kind: 'regex', pattern: 'release["\']?\\s*:' } as const

const recipe: Recipe = {
  slug: 'decode-helm-release-secret',
  name: 'Decode a Helm release Secret',
  summary:
    'Paste a Helm 3 release Secret from kubectl get secret -o yaml, or just its data.release value, and read the user-supplied values and the rendered manifest that helm get values and helm get manifest would show.',
  category: 'DevOps & Config',
  primaryQuery: 'decode helm release secret',
  published: '2026-10-07',
  related: ['decode-cloudwatch-logs-data', 'spring-boot-yaml-to-env-vars'],
  steps: [
    step('to-json', 'yaml_to_json', { indent: 2, allDocuments: false },
      'kubectl prints the Secret as YAML, or as JSON with -o json, which parses the same way. Converting it to JSON lets the next step pick one field by its path. Skipped when the input has no release key, as with a bare value from -o jsonpath.',
      { condition: HAS_RELEASE_KEY }),
    step('pick-release', 'jsonpath', { path: '$.data.release', mode: 'first', indent: 2 },
      'Keeps data.release, the only key Helm writes into the Secret. The first-match mode returns the string itself rather than a JSON array, so the next step gets bare Base64 text. Skipped, like the previous step, for a bare value.',
      { condition: HAS_RELEASE_KEY, label: 'keep data.release' }),
    step('k8s-base64', 'base64_decode', {},
      "Removes the Base64 layer the Kubernetes API puts on every Secret value. What remains is Helm's own encoding, which starts with H4sI: the gzip header bytes 1f 8b 08 in Base64. Releases stored in ConfigMaps, and values already decoded once, start there and skip this step.",
      { condition: { kind: 'regex', pattern: '^\\s*H4sI', negate: true }, label: 'remove the Kubernetes Base64 layer' }),
    step('gunzip', 'gzip_decompress', { output: 'text' },
      'Helm stores the release as JSON, gzipped and then Base64-encoded. This step reads that Base64 text itself, inflates it and checks the gzip CRC-32, giving the whole release record: chart, user-supplied values, rendered manifest, hooks and status. A truncated or damaged value stops the pipeline here with the error.',
      { onError: 'stop' }),
    branch('split', [
      [
        laneStep('values', 'jsonpath', { path: '$.config', mode: 'first', indent: 2 }, { label: 'user-supplied values' }),
        laneStep('values-yaml', 'json_to_yaml', { indent: 2, lineWidth: 0, sortKeys: false }),
        laneStep('values-header', 'insert_at', { text: '# USER-SUPPLIED VALUES (helm get values)\\n', position: 0, mode: 'insert', perLine: false }, { label: 'values header' }),
      ],
      [
        laneStep('manifest', 'jsonpath', { path: '$.manifest', mode: 'first', indent: 2 }, { label: 'rendered manifest' }),
        laneStep('manifest-header', 'insert_at', { text: '# MANIFEST (helm get manifest)\\n', position: 0, mode: 'insert', perLine: false }, { label: 'manifest header' }),
      ],
    ], { mode: 'concat', separator: '\n' },
    'Pulls out the two fields you usually want: config, the user-supplied values helm get values prints, converted to YAML; and manifest, the rendered resources helm get manifest prints. A comment header marks each part.',
    { label: 'values and manifest' }),
  ],
  samples: [
    {
      id: 'secret-yaml',
      title: 'Secret (kubectl -o yaml)',
      input: `apiVersion: v1
data:
  release: ${BILLING_API}
kind: Secret
metadata:
  creationTimestamp: "2026-10-01T16:42:07Z"
  labels:
    modifiedAt: "1790872928"
    name: billing-api
    owner: helm
    status: deployed
    version: "7"
  name: sh.helm.release.v1.billing-api.v7
  namespace: payments
  resourceVersion: "48213907"
  uid: 3f6d2a1c-8b4e-4f0a-9c7d-2e5b1a6f8d40
type: helm.sh/release.v1
`,
      output: `# USER-SUPPLIED VALUES (helm get values)
image:
  tag: 2.14.1
replicaCount: 3

# MANIFEST (helm get manifest)
---
# Source: billing-api/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: billing-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: billing-api
  template:
    metadata:
      labels:
        app: billing-api
    spec:
      containers:
        - name: api
          image: "registry.example.com/billing-api:2.14.1"
`,
    },
    {
      id: 'jsonpath-value',
      title: 'Bare value (-o jsonpath)',
      input: REPORT_EXPORT,
      output: `# USER-SUPPLIED VALUES (helm get values)
bucket: s3://reports.example.org/daily
schedule: 30 2 * * *

# MANIFEST (helm get manifest)
---
# Source: report-export/templates/cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: report-export
spec:
  schedule: "30 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: export
              image: "registry.example.com/report-export:1.2.0"
              args: ["--bucket", "s3://reports.example.org/daily"]
`,
    },
    {
      id: 'configmap-driver',
      title: 'ConfigMap (HELM_DRIVER=configmap)',
      input: `apiVersion: v1
data:
  release: ${SESSION_CACHE}
kind: ConfigMap
metadata:
  creationTimestamp: "2026-09-30T11:12:48Z"
  labels:
    modifiedAt: "1790766769"
    name: session-cache
    owner: helm
    status: deployed
    version: "3"
  name: sh.helm.release.v1.session-cache.v3
  namespace: web
  resourceVersion: "47950112"
  uid: 9a1e4c7b-2d5f-4b8e-a3c6-71f0d9e2b5a8
`,
      output: `# USER-SUPPLIED VALUES (helm get values)
evictionPolicy: allkeys-lru
maxmemory: 256mb

# MANIFEST (helm get manifest)
---
# Source: session-cache/templates/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: session-cache-config
data:
  redis.conf: |
    maxmemory 256mb
    maxmemory-policy allkeys-lru
---
# Source: session-cache/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: session-cache
spec:
  selector:
    matchLabels:
      app: session-cache
  template:
    metadata:
      labels:
        app: session-cache
    spec:
      containers:
        - name: redis
          image: "redis:7.2.5"
          args: ["/etc/redis/redis.conf"]
          volumeMounts:
            - name: config
              mountPath: /etc/redis
      volumes:
        - name: config
          configMap:
            name: session-cache-config
`,
    },
    {
      id: 'secret-json-no-values',
      title: 'Secret (-o json), no values set',
      input: `{
    "apiVersion": "v1",
    "data": {
        "release": "${STATUS_PAGE}"
    },
    "kind": "Secret",
    "metadata": {
        "creationTimestamp": "2026-10-06T09:21:34Z",
        "labels": {
            "modifiedAt": "1791278495",
            "name": "status-page",
            "owner": "helm",
            "status": "deployed",
            "version": "1"
        },
        "name": "sh.helm.release.v1.status-page.v1",
        "namespace": "ops",
        "resourceVersion": "48390551",
        "uid": "c4b8e1f2-6a3d-4e9b-8f5c-0d7a2b9e6c13"
    },
    "type": "helm.sh/release.v1"
}
`,
      output: `# USER-SUPPLIED VALUES (helm get values)

# MANIFEST (helm get manifest)
---
# Source: status-page/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: status-page
spec:
  replicas: 1
  selector:
    matchLabels:
      app: status-page
  template:
    metadata:
      labels:
        app: status-page
    spec:
      containers:
        - name: web
          image: "registry.example.com/status-page:3.0.2"
`,
    },
  ],
}
export default recipe
