"use client";

export default function Home() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 py-10">
      <section className="w-full max-w-[316px] text-center">
        <h1 className="display-font text-[29px] font-semibold tracking-[-0.04em] text-[#242424]">Login</h1>
        <a href={`${apiBase}/api/auth/google`} className="mt-5 flex h-10 items-center justify-center gap-2 rounded-[7px] bg-[#e5f6ed] text-[12px] font-medium text-[#202523] transition hover:bg-[#d8f1e3]">
          <span className="text-[15px] font-bold text-[#4285f4]">G</span>
          Login with Google
        </a>
        <div className="my-4 flex items-center gap-3 text-[10px] text-[#a5aaa8]">
          <span className="h-px flex-1 bg-[#edf0ee]" />
          or sign up through email
          <span className="h-px flex-1 bg-[#edf0ee]" />
        </div>
        <form action={`${apiBase}/api/auth/email`} method="post" className="space-y-2">
          <input name="email" type="email" placeholder="Email ID" className="quiet-input h-10 w-full rounded-[7px] px-3 text-[11px] text-[#252b28] placeholder:text-[#8e9792]" />
          <input name="password" type="password" minLength={6} required placeholder="Password" className="quiet-input h-10 w-full rounded-[7px] px-3 text-[11px] text-[#252b28] placeholder:text-[#8e9792]" />
          <button type="submit" className="mt-3 h-10 w-full rounded-[7px] bg-[#00a941] text-[12px] font-medium text-white transition hover:bg-[#008f38]">Login</button>
        </form>
      </section>
    </main>
  );
}
