import React, { useState, createContext, useContext } from 'react'
const TabsCtx = createContext(null)
export function Tabs({ defaultValue, children, className='' }) {
  const [value, setValue] = useState(defaultValue)
  return <TabsCtx.Provider value={{value,setValue}}><div className={className}>{children}</div></TabsCtx.Provider>
}
export function TabsList({ children, className='' }) { return <div className={className}>{children}</div> }
export function TabsTrigger({ value, children }) {
  const ctx = useContext(TabsCtx)
  const active = ctx.value === value
  return <button onClick={()=>ctx.setValue(value)} className={`px-3 py-2 border rounded-xl ${active?'border-white':'border-gray-600'}`}>{children}</button>
}
export function TabsContent({ value, children, className='' }) {
  const ctx = useContext(TabsCtx)
  if (ctx.value !== value) return null
  return <div className={className}>{children}</div>
}