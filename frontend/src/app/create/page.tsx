"use client";

import { useState } from "react";

export default function CreateStreamPage() {
  const [form, setForm] = useState({
    recipient: "",
    token: "",
    deposit: "",
    start_time: "",
    end_time: "",
    cliff_time: "",
    cancelable: true,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          deposit: BigInt(form.deposit).toString(),
          start_time: parseInt(form.start_time, 10),
          end_time: parseInt(form.end_time, 10),
          cliff_time: parseInt(form.cliff_time, 10),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create stream");
      }

      const data = await res.json();
      setResult(`Stream created with ID: ${data.data?.streamId || "unknown"}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Create Stream</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="recipient"
            className="block text-sm font-medium text-gray-700"
          >
            Recipient Address
          </label>
          <input
            id="recipient"
            name="recipient"
            type="text"
            required
            value={form.recipient}
            onChange={handleChange}
            className="mt-1 block w-full rounded border p-2"
            aria-required="true"
          />
        </div>

        <div>
          <label
            htmlFor="token"
            className="block text-sm font-medium text-gray-700"
          >
            Token Contract Address
          </label>
          <input
            id="token"
            name="token"
            type="text"
            required
            value={form.token}
            onChange={handleChange}
            className="mt-1 block w-full rounded border p-2"
            aria-required="true"
          />
        </div>

        <div>
          <label
            htmlFor="deposit"
            className="block text-sm font-medium text-gray-700"
          >
            Deposit Amount (whole units)
          </label>
          <input
            id="deposit"
            name="deposit"
            type="text"
            required
            value={form.deposit}
            onChange={handleChange}
            className="mt-1 block w-full rounded border p-2"
            aria-required="true"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="start_time"
              className="block text-sm font-medium text-gray-700"
            >
              Start Time (Unix)
            </label>
            <input
              id="start_time"
              name="start_time"
              type="number"
              required
              value={form.start_time}
              onChange={handleChange}
              className="mt-1 block w-full rounded border p-2"
              aria-required="true"
            />
          </div>
          <div>
            <label
              htmlFor="end_time"
              className="block text-sm font-medium text-gray-700"
            >
              End Time (Unix)
            </label>
            <input
              id="end_time"
              name="end_time"
              type="number"
              required
              value={form.end_time}
              onChange={handleChange}
              className="mt-1 block w-full rounded border p-2"
              aria-required="true"
            />
          </div>
          <div>
            <label
              htmlFor="cliff_time"
              className="block text-sm font-medium text-gray-700"
            >
              Cliff Time (Unix)
            </label>
            <input
              id="cliff_time"
              name="cliff_time"
              type="number"
              required
              value={form.cliff_time}
              onChange={handleChange}
              className="mt-1 block w-full rounded border p-2"
              aria-required="true"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="cancelable"
            name="cancelable"
            type="checkbox"
            checked={form.cancelable}
            onChange={handleChange}
            className="h-4 w-4"
          />
          <label htmlFor="cancelable" className="text-sm text-gray-700">
            Cancelable
          </label>
        </div>

        {error && (
          <div className="rounded bg-red-50 p-4 text-red-700" role="alert">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded bg-green-50 p-4 text-green-700" role="status">
            {result}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating Stream..." : "Create Stream"}
        </button>
      </form>
    </main>
  );
}