"use client";

export const ACTIVATION_PLAN_STORAGE_KEY = "flare_activation_plan";

export type ActivationPlanId = "starter" | "pro" | "business";

const VALID_ACTIVATION_PLANS = new Set<ActivationPlanId>(["starter", "pro", "business"]);

export function rememberActivationPlan(planId: string): void {
  if (typeof window === "undefined") return;
  if (!VALID_ACTIVATION_PLANS.has(planId as ActivationPlanId)) return;
  window.sessionStorage.setItem(ACTIVATION_PLAN_STORAGE_KEY, planId);
}

export function readRememberedActivationPlan(): ActivationPlanId | null {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(ACTIVATION_PLAN_STORAGE_KEY);
  return VALID_ACTIVATION_PLANS.has(value as ActivationPlanId) ? (value as ActivationPlanId) : null;
}

export function clearRememberedActivationPlan(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ACTIVATION_PLAN_STORAGE_KEY);
}
