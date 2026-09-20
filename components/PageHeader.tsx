"use client";
type Props = { totalVerbal: number; mode: "lang" | "random" };
export function PageHeader({ totalVerbal, mode }: Props) {
  const sub =
    mode === "random"
      ? "Hit 🎲 to re-roll a magic word"
      : "Type a new English cue, hit ▶ to translate, 🔊 to hear it.";
  return (
    <header className="mb-4 hidden lg:block">
      <h1 className="text-xl md:text-2xl font-bold tracking-tight">🐉 D&D Chants</h1>
      <p className="mt-1 text-[13px] md:text-sm max-w-[34rem] leading-snug text-dim">
        {totalVerbal ? `${totalVerbal} spells grouped by school. ` : ""}{sub}
      </p>
    </header>
  );
}
