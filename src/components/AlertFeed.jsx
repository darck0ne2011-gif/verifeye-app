const ExclamationIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
)

const AlertCard = ({ variant, text }) => (
  <div className="flex items-center gap-4 p-4 bg-slate-800/60 rounded-xl border border-slate-700/40">
    <span className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white ${
      variant === 'error' ? 'bg-red-500' : 'bg-green-500'
    }`}>
      {variant === 'error' ? <ExclamationIcon /> : <CheckIcon />}
    </span>
    <p className="text-white text-sm font-medium flex-1">{text}</p>
  </div>
)

export default function AlertFeed() {
  return (
    <section className="w-full">
      <h2 className="text-white font-bold text-lg mb-4">Feed de Alerte</h2>
      <div className="space-y-3">
        <AlertCard
          variant="error"
          text="Video cu Marcel Ciolacu marcat ka FAKE de 1.200 de ori azi."
        />
        <AlertCard
          variant="success"
          text="Știre despre taxa auto VERIFICATĂ. Sursa: Guvernul.ro"
        />
      </div>
    </section>
  )
}
