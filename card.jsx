export function Card({ className='', children }) {
  return <div className={`border rounded-xl ${className}`}>{children}</div>
}
export function CardContent({ className='', children }) {
  return <div className={className}>{children}</div>
}