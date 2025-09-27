import { describe, it, expect } from "vitest";
import util from "./index";
import { isUint8Array } from "node:util/types";

describe("get_bytes", () => {
  it("utf8: converts 'abc' to [97,98,99]", async () => {
    const out = await util.apply("abc", { mode: "utf8" });
    expect(isUint8Array(out)).toBe(true);
    expect(Array.from(out as Uint8Array)).toEqual([97, 98, 99]);
  });

  it("utf8: unicode ✓ -> E2 9C 93", async () => {
    const out = await util.apply("✓", { mode: "utf8" });
    expect(isUint8Array(out)).toBe(true);
    expect(Array.from(out as Uint8Array)).toEqual([0xe2, 0x9c, 0x93]);
  });

  it("hex: 'deadbeef' -> [222,173,190,239]", async () => {
    const out = await util.apply("deadbeef", { mode: "hex" });
    expect(isUint8Array(out)).toBe(true);
    expect(Array.from(out as Uint8Array)).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  it("base64: 'b2s=' -> 'ok'", async () => {
    const out = await util.apply("b2s=", { mode: "base64" });
    expect(isUint8Array(out)).toBe(true);
    expect(new TextDecoder().decode(out as Uint8Array)).toBe("ok");
  });
});
