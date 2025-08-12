


export function GlassBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full p-20 rounded-xl border border-white/20
                         bg-vlue/10 backdrop-blur-xl backdrop-filter shadow-lg shadow-black/20 md:hidden
                         hover:bg-blue/20 transition-all duration-200
                         dark:bg-blue/10 dark:border-blue/20 dark:hover:bg-white/20">
      {children}
    </div>
  )
}