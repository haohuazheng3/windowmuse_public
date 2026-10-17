import { describe, expect, it } from "vitest";
import { stripePermissionProblem } from "@/lib/stripe";

// What stripe-node raises for an HTTP 403 (the exact text Stripe answered in production).
const DENIED =
  "Permission denied. The provided key 'sk_org_live...Jp07' does not have the required permissions for this endpoint on account 'acct_123'. Enabling Invoices Read ('invoice_read') permissions on this key would allow this request to continue.";

function stripeError(over: Record<string, unknown>): Error {
  const e = new Error(typeof over.message === "string" ? over.message : "x");
  return Object.assign(e, over);
}

describe("stripePermissionProblem", () => {
  it("names the missing permission from Stripe's message", () => {
    expect(stripePermissionProblem(stripeError({ type: "StripePermissionError", statusCode: 403, message: DENIED }))).toBe("invoice_read (Invoices Read)");
  });

  it("recognises the SDK type, the status and the wording on their own", () => {
    expect(stripePermissionProblem(stripeError({ type: "StripePermissionError", message: "nope" }))).toBe("nope");
    expect(stripePermissionProblem(stripeError({ statusCode: 403, message: "" }))).toBe("permission denied");
    expect(stripePermissionProblem(stripeError({ code: "permission_denied", message: "Permission denied." }))).toBe("Permission denied.");
    expect(stripePermissionProblem(stripeError({ message: DENIED }))).toBe("invoice_read (Invoices Read)");
  });

  it("leaves every other error a real failure", () => {
    expect(stripePermissionProblem(stripeError({ type: "StripeInvalidRequestError", statusCode: 400, message: "No such invoice: 'in_1'" }))).toBeNull();
    expect(stripePermissionProblem(stripeError({ type: "StripeAuthenticationError", statusCode: 401, message: "Invalid API Key provided" }))).toBeNull();
    expect(stripePermissionProblem(stripeError({ type: "StripeConnectionError", message: "An error occurred with our connection to Stripe." }))).toBeNull();
    expect(stripePermissionProblem(new TypeError("fetch failed"))).toBeNull();
    expect(stripePermissionProblem("denied")).toBeNull();
    expect(stripePermissionProblem(null)).toBeNull();
  });
});
