export function Input({ className='', ...props }) {
  return <input className={`border rounded-lg px-3 py-2 w-full bg-background ${className}`} {...props} />
}