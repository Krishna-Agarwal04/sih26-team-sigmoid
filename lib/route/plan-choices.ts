import type { InterestTag, Persona } from "@/lib/types";

export const PLAN_KEY = "threshold.plan.v1";

export interface PlanChoices {
  interests: InterestTag[];
  budgetMinutes: number;
  persona: Persona;
}
