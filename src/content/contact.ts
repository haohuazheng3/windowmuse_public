/** Topics of the contact form; the API validates against the same list. */
export const CONTACT_TOPICS = [
  { value: "video", label: "A video or the studio" },
  { value: "billing", label: "Billing, credits or a refund" },
  { value: "account", label: "My account or sign-in" },
  { value: "privacy", label: "Privacy or my data" },
  { value: "partnership", label: "Partnership or agency use" },
  { value: "press", label: "Press" },
  { value: "other", label: "Something else" },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];
export const CONTACT_TOPIC_VALUES = CONTACT_TOPICS.map((t) => t.value) as [ContactTopic, ...ContactTopic[]];
