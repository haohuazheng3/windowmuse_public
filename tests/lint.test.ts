import { describe, expect, it } from "vitest";
import { hasFatal, LINT_RULES, lintScript } from "@/lib/scripts/lint";

const fatalIds = (text: string) => lintScript(text).fatal.map((f) => f.rule);
const warnIds = (text: string) => lintScript(text).warn.map((f) => f.rule);

describe("rule table", () => {
  it("has unique ids and the levels the product promises", () => {
    const ids = LINT_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const level = Object.fromEntries(LINT_RULES.map((r) => [r.id, r.level]));
    expect(level).toMatchObject({
      "medical-claim": "fatal",
      "weight-claim": "fatal",
      guaranteed: "fatal",
      testimony: "fatal",
      "professional-persona": "fatal",
      instant: "warn",
      "before-after": "warn",
      price: "warn",
    });
  });
});

describe("fatal findings", () => {
  it("catches medical cure/treat/prevent claims in either order", () => {
    expect(fatalIds("This cream cures eczema in days.")).toContain("medical-claim");
    expect(fatalIds("Acne is treated by this cleanser.")).toContain("medical-claim");
    expect(fatalIds("It helps prevent cavities.")).toContain("medical-claim");
    expect(fatalIds("Treat yourself to a softer towel.")).not.toContain("medical-claim");
  });
  it("catches weight-loss and fat-burning promises", () => {
    expect(fatalIds("Lose ten pounds in a week.")).toContain("weight-claim");
    expect(fatalIds("A tea that melts belly fat.")).toContain("weight-claim");
    expect(fatalIds("Lose the clutter in your drawer.")).not.toContain("weight-claim");
  });
  it("catches guarantees", () => {
    expect(fatalIds("Results guaranteed or your money back.")).toContain("guaranteed");
    expect(fatalIds("We guarantee you'll love it.")).toContain("guaranteed");
    expect(fatalIds("30-day returns, no questions asked.")).not.toContain("guaranteed");
  });
  it("catches first-person customer testimony", () => {
    expect(fatalIds("I've been using this serum for three weeks.")).toContain("testimony");
    expect(fatalIds("My skin has never felt softer.")).toContain("testimony");
    expect(fatalIds("I bought two for my mum.")).toContain("testimony");
    expect(fatalIds("As a customer, this is the one.")).toContain("testimony");
    expect(fatalIds("This serum is made with 2% niacinamide. Designed for oily skin.")).toEqual([]);
  });
  it("catches professional personas but allows plain product facts", () => {
    expect(fatalIds("As a dermatologist, this is what to look for.")).toContain("professional-persona");
    expect(fatalIds("I'm a nurse and this is in every bag.")).toContain("professional-persona");
    expect(fatalIds("The dentist in this shot is a fictional presenter.")).not.toContain("professional-persona");
    expect(warnIds("Dermatologist-recommended for sensitive skin.")).toContain("professional-endorsement");
  });
  it("hasFatal reflects the fatal list", () => {
    expect(hasFatal(lintScript("Guaranteed results."))).toBe(true);
    expect(hasFatal(lintScript("Three pockets, one zip, fits a 14-inch laptop."))).toBe(false);
  });
});

describe("warnings", () => {
  it("warns on instant claims", () => {
    expect(warnIds("Instantly brighter skin.")).toContain("instant");
    expect(warnIds("Works overnight.")).toContain("instant");
  });
  it("warns on before/after unless results may vary is present", () => {
    expect(warnIds("Visible results after four weeks.")).toContain("before-after");
    expect(warnIds("Visible results after four weeks. Individual results may vary.")).not.toContain("before-after");
  });
  it("warns on prices and promotions", () => {
    expect(warnIds("Only $12.99 this week.")).toContain("price");
    expect(warnIds("Grab it with 20% off.")).toContain("price");
    expect(warnIds("Comes in three sizes.")).not.toContain("price");
  });
  it("warns on superlatives and first person, not on 'you'", () => {
    expect(warnIds("The best bottle you will own.")).toContain("superlative");
    expect(warnIds("I think you will like the strap.")).toContain("first-person");
    expect(warnIds("You will like the strap. Let me show you.")).not.toContain("first-person");
  });
  it("adds a language-coverage note for non-English scripts only", () => {
    expect(lintScript("Tres bolsillos.", { language: "es" }).warn.map((f) => f.rule)).toContain("language-coverage");
    expect(lintScript("Three pockets.", { language: "en" }).warn.map((f) => f.rule)).not.toContain("language-coverage");
    expect(lintScript("", { language: "es" }).warn).toEqual([]);
  });
  it("reports the offending words and position", () => {
    const r = lintScript("Soft cotton. Guaranteed to last.");
    expect(r.fatal[0]).toMatchObject({ rule: "guaranteed", match: "Guaranteed", index: 13 });
  });
});
