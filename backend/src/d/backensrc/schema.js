import { z } from "zod";
const text = (min = 1, max = 200) => z.string().trim().min(min).max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T00:00:00Z");
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }, "Use a valid date");
export const detailSchemas = {
  planner: z
    .object({
      service: z.enum([
        "Full event planning",
        "On-the-day coordination",
        "Design and styling",
        "Vendor coordination",
      ]),
      guests: z.coerce.number().int().min(1).max(100000),
      style: z.enum([
        "Minimal and intimate",
        "Classic and elegant",
        "Bold and festive",
        "Contemporary",
        "Open to ideas",
      ]),
      budget: z.coerce.number().int().min(1).max(100000000),
      notes: z.string().trim().max(2000).default(""),
    })
    .strict(),
  performer: z
    .object({
      act: z.enum([
        "Live band",
        "DJ",
        "Singer",
        "Dancer",
        "Host / emcee",
        "Other act",
      ]),
      audience: z.coerce.number().int().min(1).max(100000),
      duration: z.coerce.number().int().min(15).max(1440),
      budget: z.coerce.number().int().min(1).max(100000000),
      notes: z.string().trim().max(2000).default(""),
    })
    .strict(),
  crew: z
    .object({
      department: z.enum([
        "Production",
        "Sound and lighting",
        "Hospitality",
        "Setup and logistics",
        "Photography / video",
        "Other crew",
      ]),
      count: z.coerce.number().int().min(1).max(10000),
      hours: z.coerce.number().int().min(1).max(24),
      budget: z.coerce.number().int().min(1).max(100000000),
      notes: z.string().trim().max(2000).default(""),
    })
    .strict(),
};
export const requirementSchema = z
  .object({
    eventName: text(3, 120),
    eventType: z.enum([
      "Wedding",
      "Corporate",
      "Private party",
      "Concert",
      "Community",
      "Other",
    ]),
    startDate: date,
    endDate: date,
    location: text(2, 160),
    venue: z.string().trim().max(160).default(""),
    category: z.enum(["planner", "performer", "crew"]),
    details: z.unknown(),
    idempotencyKey: z.string().uuid(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after the start date",
      });
    const today = new Date().toISOString().slice(0, 10);
    if (v.startDate < today)
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Choose today or a future date (UTC)",
      });
    const d = detailSchemas[v.category].safeParse(v.details);
    if (!d.success)
      for (const i of d.error.issues)
        ctx.addIssue({ ...i, path: ["details", ...i.path] });
  })
  .transform((v) => ({
    ...v,
    details: detailSchemas[v.category].parse(v.details),
  }));
