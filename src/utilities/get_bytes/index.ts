import { Utility } from "@/types/utility";

type Mode = "utf8" | "hex" | "base64" | "unicode";

function fromUtf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function fromHex(s: string): Uint8Array {
  const clean = s.replace(/\s+/g, "");
  if (clean.length % 2 !== 0) throw new Error("hex input must have even length");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    const pair = clean.slice(i, i + 2);
    if (!/^[0-9a-fA-F]{2}$/.test(pair)) throw new Error("invalid hex");
    out[i / 2] = Number.parseInt(pair, 16);
  }
  return out;
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s.replace(/\s+/g, ""));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function fromUnicode(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out[i * 2] = (code >> 8) & 0xff;
    out[i * 2 + 1] = code & 0xff;
  }
  return out;
}


const util: Utility = {
  id: "get_bytes",
  name: "Get bytes",
  description: "Convert a string into bytes. Modes: utf8 (default), hex, base64, unicode.",
  category: "Encoding",
  accepts: ["string"],
  produces: "bytes",
  tags: ['bytes', 'utf8', 'hex', 'unicode', 'encode', 'binary'],
  examples: [
    { title: 'utf8 mode', input: 'Hi', params: { mode: 'utf8' }, output: 'bytes[72, 105]\nhex: [48, 69]\nutf8: Hi' },
    { title: 'hex mode', input: '48 69', params: { mode: 'hex' }, output: 'bytes[72, 105]\nhex: [48, 69]\nutf8: Hi' },
    { title: 'unicode mode (UTF-16 code units)', input: 'Hi', params: { mode: 'unicode' }, output: 'bytes[00, 72, 00, 105]\nhex: [00, 48, 00, 69]\nutf8: \u0000H\u0000i' }
  ],
  params: {
    mode: {
      kind: 'select',
      label: 'Mode',
      options: [
        'utf8',
        'hex',
        'base64',
        'unicode'
      ],
      default: 'utf8',
    }
  },
  async apply(input: string, params?: { mode?: Mode }): Promise<Uint8Array> {
    const mode: Mode = params?.mode ?? "utf8";
    if (typeof input !== "string") throw new Error("get_bytes expects string");
    switch (mode) {
      case "utf8":
        return fromUtf8(input);
      case "hex":
        return fromHex(input);
      case "base64":
        return fromBase64(input);
      case "unicode":
        return fromUnicode(input);

      default: {
        const _never: never = mode;
        throw new Error(`unsupported mode: ${_never as string}`);
      }
    }
  }
};

export default util;
