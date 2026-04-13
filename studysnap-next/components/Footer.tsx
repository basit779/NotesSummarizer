export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/[0.05]">
      <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
        <span className="mono">© {new Date().getFullYear()} studysnap.ai</span>
        <span>Study at the speed of thought.</span>
      </div>
    </footer>
  );
}
