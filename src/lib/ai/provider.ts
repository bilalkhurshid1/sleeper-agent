import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { Settings } from "@/generated/prisma/client";
import type { LanguageModel } from "ai";

export const PROVIDER_MODELS: Record<"anthropic" | "openai", string[]> = {
  anthropic: ["claude-opus-4-8", "claude-sonnet-5", "claude-opus-4-7", "claude-haiku-4-5"],
  openai: ["gpt-4o", "gpt-4o-mini"],
};

export function getModel(settings: Pick<Settings, "provider" | "model">): LanguageModel {
  if (settings.provider === "openai") return openai(settings.model);
  return anthropic(settings.model);
}
