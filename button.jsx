export function Button({ children, onClick, variant='default', size='md', asChild, className='', ...rest }) {
  const base = 'px-3 py-2 rounded-xl border';
  const style = variant==='destructive' ? 'border-red-600' : variant==='secondary' ? 'border-gray-500' : 'border-gray-400';
  const Comp = asChild ? 'span' : 'button';
  return <Comp onClick={onClick} className={`${base} ${style} ${className}`} {...rest}>{children}</Comp>
}