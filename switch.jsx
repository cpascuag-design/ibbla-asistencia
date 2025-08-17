export function Switch({ checked, onCheckedChange }) {
  return <input type="checkbox" checked={checked} onChange={e => onCheckedChange(e.target.checked)} />
}