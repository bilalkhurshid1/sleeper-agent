import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/coach" className="text-sm font-semibold text-zinc-900">
          Sleeper Dynasty Coach
        </Link>
        <nav className="flex gap-4 text-sm text-zinc-600">
          <Link href="/coach" className="hover:text-zinc-900">
            Coach
          </Link>
          <Link href="/settings" className="hover:text-zinc-900">
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
