export function Badge({ children, variant='default', className='' }) {
  const style = variant==='destructive' ? 'border-red-600' : 'border-gray-500';
  return <span className={`px-2 py-1 text-xs border rounded-full ${style} ${className}`}>{children}</span>
}