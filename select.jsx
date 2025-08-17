import React, { useState, useContext, createContext } from 'react'
const Ctx = createContext(null)
export function Select({ value, onValueChange, children }) {
  return <Ctx.Provider value={{value,onValueChange}}><div>{children}</div></Ctx.Provider>
}
export function SelectTrigger({ children }) { return <div>{children}</div> }
export function SelectValue({ placeholder }) { return <span>{placeholder}</span> }
export function SelectContent({ children }) { return <div>{children}</div> }
export function SelectItem({ value, children }) {
  const ctx = useContext(Ctx)
  const active = ctx.value === value
  return <div style={{cursor:'pointer', padding:'6px', border:'1px solid #2a2a2a', marginBottom:'6px', borderRadius:'8px'}} onClick={()=>ctx.onValueChange(value)}>
    <span>{children}{active ? ' ✓':''}</span>
  </div>
}