export function Footer() {
  return (
    <footer className="border-t mt-20">
      <div className="container flex h-16 items-center justify-between text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} StudySnap AI</span>
        <span>Built for students who want to study smarter.</span>
      </div>
    </footer>
  );
}
