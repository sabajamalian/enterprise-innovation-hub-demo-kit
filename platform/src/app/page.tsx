"use client";

import { FormEvent, useState } from "react";

type Result = {
  status: string;
  repositoryUrl?: string;
  applicationUrl?: string;
  error?: string;
};

export default function Home() {
  const [result, setResult] = useState<Result>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(undefined);
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/ideas", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID()
      },
      body: JSON.stringify({
        name: data.get("name"),
        problem: data.get("problem"),
        repositorySlug: data.get("repositorySlug"),
        audienceGroupIds: String(data.get("audienceGroupIds"))
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      })
    });
    setResult(await response.json());
    setPending(false);
  }

  return (
    <main>
      <p className="eyebrow">CUSTOMER-OWNED INNOVATION PLATFORM</p>
      <h1>Start with the operational problem.</h1>
      <p className="lede">
        The Hub creates a governed repository and application boundary. Continue the work in
        Copilot CLI, Copilot Desktop, or VS Code, where the engineering instructions stay with the code.
      </p>
      <form onSubmit={submit}>
        <label>
          Idea name
          <input name="name" minLength={3} maxLength={80} required />
        </label>
        <label>
          Problem statement
          <textarea name="problem" minLength={20} maxLength={2000} rows={6} required />
        </label>
        <label>
          Repository slug
          <input name="repositorySlug" pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
        </label>
        <label>
          Audience group object IDs
          <input name="audienceGroupIds" placeholder="UUID, UUID" required />
        </label>
        <button disabled={pending}>{pending ? "Provisioning..." : "Create workspace"}</button>
      </form>
      {result && (
        <section className="result" aria-live="polite">
          <strong>Status: {result.status ?? "failed"}</strong>
          {result.error && <p>{result.error}</p>}
          {result.repositoryUrl && <a href={result.repositoryUrl}>Open repository</a>}
          {result.applicationUrl && <a href={result.applicationUrl}>Open application</a>}
        </section>
      )}
    </main>
  );
}
