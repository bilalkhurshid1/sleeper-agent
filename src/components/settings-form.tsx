"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  defaultProvider: "anthropic" | "openai";
  defaultModel: string;
  defaultOverride: string;
  models: Record<"anthropic" | "openai", string[]>;
};

const labelCls = "text-xs uppercase tracking-wide text-zinc-500";
const inputCls =
  "w-full rounded border border-zinc-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-zinc-500";

export function SettingsForm({ defaultProvider, defaultModel, defaultOverride, models }: Props) {
  const router = useRouter();
  const [provider, setProvider] = useState<"anthropic" | "openai">(defaultProvider);
  const [model, setModel] = useState(defaultModel);
  const [override, setOverride] = useState(defaultOverride);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const visibleModels = models[provider];
  const modelOk = visibleModels.includes(model);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: modelOk ? model : visibleModels[0],
          systemPromptOverride: override,
        }),
      });
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelCls}>Provider</label>
        <div className="mt-1 flex gap-3 text-sm">
          {(Object.keys(models) as Array<"anthropic" | "openai">).map((p) => (
            <label key={p} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="provider"
                value={p}
                checked={provider === p}
                onChange={() => {
                  setProvider(p);
                  if (!models[p].includes(model)) setModel(models[p][0]);
                }}
              />
              {p}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Model</label>
        <select
          value={modelOk ? model : visibleModels[0]}
          onChange={(e) => setModel(e.target.value)}
          className={inputCls}
        >
          {visibleModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>System prompt override (optional)</label>
        <textarea
          rows={4}
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          className={`${inputCls} font-mono`}
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
      >
        {saving ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
    </form>
  );
}
