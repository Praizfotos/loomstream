import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Loomstream</h1>
      <p className="mt-4 text-lg text-gray-600">
        Token streaming and vesting primitive for Stellar Soroban
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/dashboard"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Dashboard
        </Link>
        <Link
          href="/create"
          className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          Create Stream
        </Link>
      </div>
    </main>
  );
}