function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight">Life Manager</h1>
          <span className="text-sm text-slate-500">v0.1.0</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-3xl font-bold tracking-tight">
            Welcome to your Life Manager
          </h2>
          <p className="mx-auto mt-3 max-w-md text-slate-500">
            The foundation is set up with React, Vite, and Tailwind CSS. Start
            building the features that help you manage your life.
          </p>
        </div>
      </main>
    </div>
  )
}

export default App
