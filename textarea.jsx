export function Textarea({ className='', ...props }) {
  return <textarea className={`border rounded-lg px-3 py-2 w-full bg-background ${className}`} {...props} />
}