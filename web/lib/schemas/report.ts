import { z } from 'zod';

export const DimensionSchema = z.object({
  dimension: z.enum([
    'framing',
    'lighting',
    'background',
    'eye_contact',
    'posture',
    'vocal_presence',
  ]),
  score: z.number().int().min(1).max(5),
  observation: z.string().min(10).max(280),
  fix: z.string().min(10).max(280),
});

export const ReportSchema = z.object({
  dimensions: z.array(DimensionSchema).length(6),
  generated_at: z.string().datetime(),
  partial: z.boolean(), // true if one of the two analyzers failed
});

export type Dimension = z.infer<typeof DimensionSchema>;
export type Report = z.infer<typeof ReportSchema>;
