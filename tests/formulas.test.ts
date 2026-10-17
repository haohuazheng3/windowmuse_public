import { describe, expect, it } from "vitest";
import { FormulaError, compileFormula, evaluateFormula, formatValue, formulaIdentifiers, parseFormula } from "@/components/tools/formulas";

describe("formula parser", () => {
  it("does arithmetic with the usual precedence", () => {
    expect(evaluateFormula("1 + 2 * 3")).toBe(7);
    expect(evaluateFormula("(1 + 2) * 3")).toBe(9);
    expect(evaluateFormula("10 / 4")).toBe(2.5);
    expect(evaluateFormula("10 % 4")).toBe(2);
    expect(evaluateFormula("2 ^ 3 ^ 2")).toBe(512);
    expect(evaluateFormula("-2 ^ 2")).toBe(-4);
    expect(evaluateFormula("2 ^ -1")).toBe(0.5);
    expect(evaluateFormula("2 * -3")).toBe(-6);
    expect(evaluateFormula("-(3 - 5)")).toBe(2);
    expect(evaluateFormula(".5 + 1e2")).toBe(100.5);
  });

  it("reads names from the scope and reports unknown ones", () => {
    expect(evaluateFormula("price * (1 - fee / 100)", { price: 20, fee: 6 })).toBeCloseTo(18.8);
    expect(() => evaluateFormula("price * 2", {})).toThrow(FormulaError);
    expect(() => evaluateFormula("price * 2", {})).toThrow(/Unknown name "price"/);
  });

  it("supports the helper functions", () => {
    expect(evaluateFormula("min(3, 1, 2)")).toBe(1);
    expect(evaluateFormula("max(3, 1, 2)")).toBe(3);
    expect(evaluateFormula("round(2.5)")).toBe(3);
    expect(evaluateFormula("round(2.345, 2)")).toBe(2.35);
    expect(evaluateFormula("ceil(2.1)")).toBe(3);
    expect(evaluateFormula("floor(2.9)")).toBe(2);
    expect(evaluateFormula("abs(-4)")).toBe(4);
    expect(evaluateFormula("sqrt(16)")).toBe(4);
    expect(evaluateFormula("clamp(15, 0, 10)")).toBe(10);
    expect(evaluateFormula("if(words > 38, words - 38, 0)", { words: 45 })).toBe(7);
    expect(evaluateFormula("if(words > 38, words - 38, 0)", { words: 20 })).toBe(0);
  });

  it("comparisons yield 1 or 0", () => {
    expect(evaluateFormula("3 > 2")).toBe(1);
    expect(evaluateFormula("3 <= 2")).toBe(0);
    expect(evaluateFormula("2 == 2")).toBe(1);
    expect(evaluateFormula("2 != 2")).toBe(0);
    expect(evaluateFormula("1 + 1 >= 2")).toBe(1);
  });

  it("rejects anything outside the grammar with a position", () => {
    for (const bad of ["", "1 +", "foo(1)", "round()", "1 2", "a = 1", "x;", "if(1,2)", "2 ** 3", "`x`", "(1"]) {
      expect(() => parseFormula(bad), bad).toThrow(FormulaError);
    }
    try {
      parseFormula("price $ 2");
    } catch (e) {
      expect(e).toBeInstanceOf(FormulaError);
      expect((e as FormulaError).position).toBe(6);
    }
  });

  it("never evaluates JavaScript", () => {
    expect(() => parseFormula("constructor.constructor('return 1')()")).toThrow();
    expect(() => evaluateFormula("__proto__", {})).toThrow(/Unknown name/);
    expect(() => evaluateFormula("toString", {})).toThrow(/Unknown name/);
  });

  it("lists identifiers in order of first use and compiles once", () => {
    const c = compileFormula("round(seconds * pace) + seconds");
    expect(c.identifiers).toEqual(["seconds", "pace"]);
    expect(formulaIdentifiers(parseFormula("1 + 2"))).toEqual([]);
    expect(c.evaluate({ seconds: 15, pace: 2.5 })).toBe(53);
  });

  it("propagates NaN and Infinity instead of throwing", () => {
    expect(evaluateFormula("a / 0", { a: 1 })).toBe(Infinity);
    expect(Number.isNaN(evaluateFormula("a * 2", { a: NaN }))).toBe(true);
  });
});

describe("formatValue", () => {
  it("formats every output format and shows a dash for non-finite values", () => {
    expect(formatValue(39, "usd")).toBe("$39");
    expect(formatValue(0.5625, "precise")).toBe("0.5625");
    expect(formatValue(1080 / 1920, "ratio")).toBe("9:16");
    expect(formatValue(1920 / 1080, "ratio")).toBe("16:9");
    expect(formatValue(1366 / 768, "ratio")).toBe("683:384");
    expect(formatValue(1.3333333333, "ratio")).toBe("4:3");
    expect(formatValue(1, "ratio")).toBe("1:1");
    expect(formatValue(0, "ratio")).toBe("—");
    expect(evaluateFormula("gcd(1080, 1920)")).toBe(120);
    expect(evaluateFormula("1920 / gcd(1080, 1920)")).toBe(16);
    expect(formatValue(1, "yesno")).toBe("Yes");
    expect(formatValue(0, "yesno")).toBe("No");
    expect(formatValue(NaN, "yesno")).toBe("—");
    expect(formatValue(3.9, "usd")).toBe("$3.90");
    expect(formatValue(1234.5, "usd")).toBe("$1,234.50");
    expect(formatValue(-5, "usd")).toBe("−$5");
    expect(formatValue(12.345, "pct")).toBe("12.3%");
    expect(formatValue(1234.6, "int")).toBe("1,235");
    expect(formatValue(15.25, "seconds")).toBe("15.3 s");
    expect(formatValue(1, "words")).toBe("1 word");
    expect(formatValue(37.6, "words")).toBe("38 words");
    expect(formatValue(2.3456, "number")).toBe("2.35");
    expect(formatValue(NaN, "usd")).toBe("—");
    expect(formatValue(Infinity, "int")).toBe("—");
  });
});
