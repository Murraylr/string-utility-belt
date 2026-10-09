---
title: Decode a Helm Release Secret (sh.helm.release.v1)
description: Paste a sh.helm.release.v1 Secret, or just its data.release value, and read the release's user-supplied values and rendered manifest without helm.
---

## What Helm keeps in a release Secret

Helm 3 records every install, upgrade and rollback as a new revision. With the default storage driver, each revision is a Kubernetes Secret named `sh.helm.release.v1.<release>.v<revision>`, of type `helm.sh/release.v1` and labelled `owner=helm`. Its only data key, `release`, holds the complete release record: the chart with its templates and default values, the values you supplied with `-f` and `--set`, the rendered manifest, hooks, notes and status.

Reading it by hand is awkward because the record sits under three layers. Helm serialises the release to JSON, gzips it and Base64-encodes the result, and the Kubernetes API shows every Secret value Base64-encoded once more. One decode gives you more Base64, the next gives you binary, and the JSON underneath is a single line carrying the whole chart. `helm get values` and `helm get manifest` undo all of this, but need the helm binary and access to the cluster. When all you have is the Secret, from a kubectl session without helm, a namespace backup or a paste in a ticket, this preset reads it directly.

## What each step does, and why in this order

[yaml to json](/util/yaml_to_json/) parses the Secret as kubectl printed it; output from `-o json` comes through the same way, since JSON is also valid YAML. [jsonpath query](/util/jsonpath/) with `$.data.release` keeps the one field that matters and, in `first` mode, passes it on as plain text rather than a JSON array. Both steps run only when the input contains a `release:` key, so you can also paste the bare value that `-o jsonpath='{.data.release}'` prints.

[base64 decode](/util/base64_decode/) removes the Kubernetes layer. What comes out starts with `H4sI`, which is how the gzip header bytes `1f 8b 08` look in Base64, and that prefix is the step's condition: a ConfigMap written with `HELM_DRIVER=configmap` stores Helm's string without the extra layer, as does a value you already ran through one `base64 --decode`, so for those the step stands aside. [gzip decompress](/util/gzip_decompress/) accepts the Base64 text directly, inflates it and checks the CRC-32 in the gzip trailer. A truncated or damaged value stops the pipeline at this step with the error, rather than being decoded into partial JSON.

The last step is a branch that splits the release JSON in two. One lane takes `$.config`, the values supplied at install or upgrade time, and turns it into YAML with [json to yaml](/util/json_to_yaml/), line wrapping off so long strings stay on one line. The other takes `$.manifest`, the rendered resources as Helm stored them, each document headed by a `# Source:` comment naming its template. [insert at position](/util/insert_at/) puts a comment header above each part. The order is fixed: each layer has to come off before the next one is visible.

## Limits and gotchas

The values section holds the same data as `helm get values`, not `helm get values --all`. The chart's defaults are in `$.chart.values`, and pointing the first lane there shows them, but nothing here merges defaults with overrides the way Helm does. A release installed without any `-f` or `--set` has no `config` field at all, so its values section is empty, as in the JSON sample.

The YAML is not byte-for-byte what helm prints. List items are indented under their key, and strings such as `yes`, `no`, `on` and `off` come out unquoted: json to yaml writes YAML 1.2, where they are plain strings, while Helm reads values files as YAML 1.1, where they are booleans. Quote them before saving the section as a values file for `helm upgrade -f`.

Hooks are stored apart from the manifest. Pre-install Jobs, test Pods and other hook resources are under `$.hooks`, and the rendered NOTES.txt is in `$.info.notes`: point the manifest lane at `$.info.notes`, or at `$.hooks[0].manifest` for the first hook.

Paste one revision at a time. Each is its own Secret: the `version` label is the revision number and the `status` label shows which one is `deployed`. A list printed by `kubectl get secret -l owner=helm -o yaml` keeps its Secrets under `items`, so `$.data.release` finds nothing and both sections come out empty, with no error. Releases from Helm 2, which Tiller stored in its own protobuf format, are not decoded here.

User-supplied values often include passwords or tokens passed with `--set`, and the output shows them in clear text, so treat it with the same care as the Secret it came from. The steps run in your browser; the pasted Secret is not uploaded.

## The same thing from a terminal

With helm and access to the cluster, `helm get values billing-api -n payments --revision 7` and `helm get manifest billing-api -n payments --revision 7` print the same two parts, and `helm get all` adds hooks and notes. With only kubectl, undo both Base64 layers and the gzip yourself, then pick the field with jq:

`kubectl get secret sh.helm.release.v1.billing-api.v7 -n payments -o jsonpath='{.data.release}' | base64 --decode | base64 --decode | gunzip | jq '.config'`

Swap `jq '.config'` for `jq -r '.manifest'` to print the manifest. For a release stored in a ConfigMap, ask for `configmap` instead of `secret` and drop one `base64 --decode`. The long `--decode` flag works with both GNU coreutils and the macOS base64.
