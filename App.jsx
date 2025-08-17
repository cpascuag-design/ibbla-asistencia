import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Check, LineChart, Settings, UserRoundPlus, Users } from "lucide-react";
import { ResponsiveContainer, LineChart as RLineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

/**
 * IBBLA Asistencia – App web (Google Sheets backend opcional)
 *
 * ✔ Clases preconfiguradas: Logos (18-24), Smart Class (25-39), Moriah (40-55), Horeb (56-65), Sabiduría (+66)
 * ✔ Docente por clase editable. Alumnos con teléfono opcional.
 * ✔ Tomar asistencia semanal con nota por alumno.
 * ✔ Estadísticas por fecha y por persona (rachas, % y alerta de abandono ≥3 semanas).
 * ✔ Persistencia local (localStorage) + modo sincronizado con Google Sheets (Apps Script WebApp).
 * ✔ Pruebas internas accesibles en la pestaña 🧪 Tests.
 */

// ===================== CONFIGURACIÓN BACKEND =====================
// 1) Pega aquí la URL del WebApp de Google Apps Script cuando lo despliegues.
//    Si está vacía, la app funciona en modo LOCAL (solo localStorage).
//    Ejemplo: const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfy.../exec";
const SHEETS_WEBAPP_URL = ""; // <- si la dejas vacía, funciona en local

// 2) Si SHEETS_WEBAPP_URL tiene valor, se activa el modo "sheets".
const SYNC_MODE = SHEETS_WEBAPP_URL ? "sheets" : "local";

// ================= Utilidades =================
const STORAGE_KEY = "ibbla_asistencia_v3"; // bump version al agregar backend
const deepClone = (obj) => (typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)));

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error cargando estado local:", e);
    return null;
  }
}

function saveLocal(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Error guardando estado local:", e);
  }
}

const DEFAULT_CLASSES = [
  { id: "logos", nombre: "Logos", rango: "18–24 años", docente: "", alumnos: [] },
  { id: "smart", nombre: "Smart Class", rango: "25–39 años", docente: "", alumnos: [] },
  { id: "moriah", nombre: "Moriah", rango: "40–55 años", docente: "", alumnos: [] },
  { id: "horeb", nombre: "Horeb", rango: "56–65 años", docente: "", alumnos: [] },
  { id: "sabiduria", nombre: "Sabiduría", rango: "+66 años", docente: "", alumnos: [] },
];

// Modelo de datos
// {
//   version: number,
//   updatedAt: string (ISO),
//   clases: [ { id, nombre, rango, docente, alumnos: [ { id, nombre, telefono?: string } ] } ],
//   asistencias: { [fechaISO]: { [classId]: { [alumnoId]: { presente: boolean, nota?: string } } } }
// }

const newId = () => Math.random().toString(36).slice(2, 10);
const normalizePhone = (t) => (t || "").replace(/[^+\d]/g, "");

function ensureStateShape(s) {
  const base = { version: 1, updatedAt: new Date().toISOString(), clases: DEFAULT_CLASSES.map((c) => ({ ...c })), asistencias: {} };
  if (!s || typeof s !== "object") return base;
  if (!Array.isArray(s.clases)) s.clases = base.clases;
  if (!s.asistencias || typeof s.asistencias !== "object") s.asistencias = {};
  if (!s.version) s.version = 1;
  if (!s.updatedAt) s.updatedAt = new Date().toISOString();
  // Normalizar alumnos
  s.clases.forEach((c) => {
    if (!Array.isArray(c.alumnos)) c.alumnos = [];
  });
  return s;
}

// ======== Backend (Apps Script WebApp) – fetch helpers ========
async function remoteLoad() {
  const res = await fetch(SHEETS_WEBAPP_URL, { method: "GET" });
  if (!res.ok) throw new Error("Remote load failed");
  const json = await res.json();
  return ensureStateShape(json);
}

async function remoteSave(state) {
  const body = JSON.stringify(state);
  const res = await fetch(SHEETS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) throw new Error("Remote save failed");
  const json = await res.json();
  return json;
}

// ================== UI: Encabezado ==================
function Header({ sync }) {
  const connected = sync.mode === "sheets";
  const statusColor = connected ? (sync.status === "synced" ? "bg-green-500" : sync.status === "syncing" ? "bg-amber-500" : "bg-slate-400") : "bg-slate-400";
  const label = connected ? (sync.status === "synced" ? "Sheets conectado" : sync.status === "syncing" ? "Sincronizando…" : "Sheets listo") : "Modo local";
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div>
        <h1 className="text-2xl font-bold">IBBLA – Registro de Asistencia</h1>
        <p className="text-sm text-muted-foreground">Seguimiento semanal por clase y por persona, con estadísticas.</p>
      </div>
      <div className="hidden md:flex items-center gap-2">
        <span className={`inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full text-white ${statusColor}`}>
          <span className="w-2 h-2 rounded-full bg-white/80" /> {label}
        </span>
      </div>
    </div>
  );
}

// ================== UI: Tarjeta Clase ==================
function ClassCard({ clase, onChangeDocente, onAddAlumno, onRemoveAlumno, onEditAlumnoTelefono }) {
  const [alumnoNombre, setAlumnoNombre] = useState("");
  const [alumnoTel, setAlumnoTel] = useState("");
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{clase.nombre} <span className="text-sm text-muted-foreground">({clase.rango})</span></h3>
            <div className="flex items-center gap-2 mt-1">
              <Label className="text-xs">Docente</Label>
              <Input
                className="h-8 w-56"
                placeholder="Nombre del docente"
                value={clase.docente}
                onChange={(e) => onChangeDocente(clase.id, e.target.value)}
              />
            </div>
          </div>
          <Badge>{clase.alumnos.length} alumnos</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Nombre del alumno"
            value={alumnoNombre}
            onChange={(e) => setAlumnoNombre(e.target.value)}
          />
          <Input
            placeholder="Teléfono (opcional)"
            value={alumnoTel}
            onChange={(e) => setAlumnoTel(e.target.value)}
          />
        </div>
        <Button
          onClick={() => {
            if (!alumnoNombre.trim()) return;
            onAddAlumno(clase.id, { id: newId(), nombre: alumnoNombre.trim(), telefono: alumnoTel.trim() });
            setAlumnoNombre("");
            setAlumnoTel("");
          }}
        >
          <UserRoundPlus className="w-4 h-4 mr-1" /> Añadir Alumno
        </Button>

        <div className="grid md:grid-cols-2 gap-2">
          {clase.alumnos.map((a) => (
            <div key={a.id} className="flex flex-col border rounded-xl px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{a.nombre}</p>
                  <p className="text-[11px] text-muted-foreground">📞 {a.telefono || "(sin teléfono)"}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onRemoveAlumno(clase.id, a.id)}>Eliminar</Button>
              </div>
              <Input
                className="mt-1 h-8"
                placeholder="Teléfono"
                value={a.telefono || ""}
                onChange={(e) => onEditAlumnoTelefono(clase.id, a.id, e.target.value)}
              />
            </div>
          ))}
          {clase.alumnos.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Aún no hay alumnos. Agrega algunos para esta clase.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ================== UI: Tomar Asistencia ==================
function AttendanceTaker({ state, setState }) {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [claseId, setClaseId] = useState(state.clases[0]?.id ?? "");

  const registrosFecha = state.asistencias[fecha] || {};
  const registrosClase = registrosFecha[claseId] || {};
  const clase = state.clases.find((c) => c.id === claseId);

  function togglePresente(alumnoId, presente) {
    setState((prev) => {
      const p = deepClone(prev);
      p.asistencias[fecha] = p.asistencias[fecha] || {};
      p.asistencias[fecha][claseId] = p.asistencias[fecha][claseId] || {};
      p.asistencias[fecha][claseId][alumnoId] = p.asistencias[fecha][claseId][alumnoId] || {};
      p.asistencias[fecha][claseId][alumnoId].presente = presente;
      p.updatedAt = new Date().toISOString();
      return p;
    });
  }

  function setNota(alumnoId, nota) {
    setState((prev) => {
      const p = deepClone(prev);
      p.asistencias[fecha] = p.asistencias[fecha] || {};
      p.asistencias[fecha][claseId] = p.asistencias[fecha][claseId] || {};
      p.asistencias[fecha][claseId][alumnoId] = p.asistencias[fecha][claseId][alumnoId] || {};
      p.asistencias[fecha][claseId][alumnoId].nota = nota;
      p.updatedAt = new Date().toISOString();
      return p;
    });
  }

  function setTelefono(alumnoId, telefono) {
    setState((prev) => {
      const p = deepClone(prev);
      const cls = p.clases.find((c) => c.id === claseId);
      if (!cls) return p;
      const alumno = cls.alumnos.find((a) => a.id === alumnoId);
      if (alumno) alumno.telefono = telefono;
      p.updatedAt = new Date().toISOString();
      return p;
    });
  }

  const presentes = Object.values(registrosClase).filter((r) => r.presente).length;
  const total = clase?.alumnos.length ?? 0;

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Fecha (semana)</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Clase</Label>
            <Select value={claseId} onValueChange={setClaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione una clase" />
              </SelectTrigger>
              <SelectContent>
                {state.clases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre} — Docente: {c.docente || "(sin asignar)"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Badge className="h-9 flex items-center"><CalendarDays className="w-4 h-4 mr-1" /> {presentes}/{total} presentes</Badge>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-2">
          {clase?.alumnos.map((a) => {
            const reg = registrosClase[a.id] || { presente: false, nota: "" };
            const tel = a.telefono || "";
            const telHref = normalizePhone(tel);
            return (
              <div key={a.id} className="flex flex-col gap-2 border rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.nombre}</p>
                    <p className="text-[11px] text-muted-foreground">{clase.nombre} • Docente: {clase.docente || "(sin asignar)"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!reg.presente} onCheckedChange={(v) => togglePresente(a.id, v)} />
                    <span className="text-sm">{reg.presente ? "Presente" : "Ausente"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-3">
                    <Input
                      placeholder="Teléfono del alumno"
                      value={tel}
                      onChange={(e) => setTelefono(a.id, e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-3 text-[12px]">
                    <span className="text-muted-foreground">📞 {tel || "—"}</span>
                    {telHref && <a className="underline" href={`tel:${telHref}`}>Llamar</a>}
                  </div>
                </div>

                <Textarea
                  className="min-h-[40px]"
                  placeholder="Nota breve (opcional): motivo de ausencia, seguimiento, etc."
                  value={reg.nota || ""}
                  onChange={(e) => setNota(a.id, e.target.value)}
                />
              </div>
            );
          })}
          {total === 0 && <p className="text-sm text-muted-foreground italic">Agregue alumnos a esta clase en Configuración.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ================== UI: Estadísticas por Fecha ==================

function StatsByDate({ state }) {
  const serie = useMemo(() => {
    const map = {};
    for (const [f, porClase] of Object.entries(state.asistencias)) {
      let count = 0;
      for (const cId of Object.keys(porClase)) {
        for (const aId of Object.keys(porClase[cId])) {
          if (porClase[cId][aId]?.presente) count += 1;
        }
      }
      map[f] = count;
    }
    const arr = Object.entries(map)
      .map(([fecha, total]) => ({ fecha, total }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    return arr;
  }, [state.asistencias]);

  const ranking = useMemo(() => {
    return [...serie].sort((a, b) => b.total - a.total);
  }, [serie]);

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><LineChart className="w-4 h-4"/> Tendencia de asistencia por fecha</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RLineChart data={serie} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="total" strokeWidth={2} dot={{ r: 2 }} />
              </RLineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold">Fechas fuertes vs débiles</h3>
          {ranking.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay datos.</p>}
          {ranking.slice(0, 5).map((r, idx) => (
            <div key={r.fecha} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={idx === 0 ? "default" : "secondary"}>{idx + 1}</Badge>
                <span className="text-sm">{r.fecha}</span>
              </div>
              <span className="text-sm font-medium">{r.total}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2">Breakdown por clase (última fecha tomada)</h3>
          <ClassBreakdownLast state={state} />
        </CardContent>
      </Card>
    </div>
  );
}

function ClassBreakdownLast({ state }) {
  const ultimaFecha = useMemo(() => {
    const fechas = Object.keys(state.asistencias).sort();
    return fechas[fechas.length - 1];
  }, [state.asistencias]);

  const data = useMemo(() => {
    if (!ultimaFecha) return [];
    const porClase = state.asistencias[ultimaFecha] || {};
    return state.clases.map((c) => {
      const registros = porClase[c.id] || {};
      let presentes = 0;
      for (const aId of Object.keys(registros)) if (registros[aId]?.presente) presentes += 1;
      return { clase: c.nombre, presentes };
    });
  }, [state.asistencias, state.clases, ultimaFecha]);

  if (!ultimaFecha) return <p className="text-sm text-muted-foreground">Sin registros todavía.</p>;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="clase" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="presentes" />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-2">Última fecha registrada: {ultimaFecha}</p>
    </div>
  );
}

// ================== UI: Estadísticas por Persona ==================
function StatsByPerson({ state }) {
  const personas = useMemo(() => {
    const idx = {};
    state.clases.forEach((c) => {
      c.alumnos.forEach((a) => {
        idx[a.id] = { alumnoId: a.id, nombre: a.nombre, telefono: a.telefono, clase: c.nombre, docente: c.docente, classId: c.id };
      });
    });

    const fechas = Object.keys(state.asistencias).sort();
    const weeksTotal = fechas.length || 0;

    const porPersona = Object.values(idx).map((p) => {
      let presentes = 0;
      let lastAttendance = null; // fecha última asistencia presente
      let currentAbsentStreak = 0;
      let running = 0; // conteo de ausencias consecutivas desde la fecha más reciente hacia atrás

      for (let i = fechas.length - 1; i >= 0; i--) {
        const f = fechas[i];
        const reg = state.asistencias[f]?.[p.classId]?.[p.alumnoId];
        if (reg?.presente) {
          presentes += 1;
          if (!lastAttendance) lastAttendance = f;
          if (running === 0) currentAbsentStreak = 0;
          running = 0;
        } else {
          running += 1;
          if (!lastAttendance) currentAbsentStreak = running;
        }
      }

      const porcentaje = weeksTotal ? Math.round((presentes / weeksTotal) * 100) : 0;
      const abandono = currentAbsentStreak >= 3; // alerta si 3 semanas seguidas sin asistir

      return { ...p, presentes, semanas: weeksTotal, porcentaje, lastAttendance, currentAbsentStreak, abandono };
    });

    porPersona.sort((a, b) => {
      if (a.abandono !== b.abandono) return b.abandono - a.abandono;
      if (a.currentAbsentStreak !== b.currentAbsentStreak) return b.currentAbsentStreak - a.currentAbsentStreak;
      return a.nombre.localeCompare(b.nombre);
    });

    return porPersona;
  }, [state]);

  const [filtro, setFiltro] = useState("");

  const filtrados = personas.filter((p) => (
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    (p.telefono || "").includes(filtro) ||
    p.clase.toLowerCase().includes(filtro.toLowerCase()) ||
    (p.docente || "").toLowerCase().includes(filtro.toLowerCase())
  ));

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-end gap-3">
          <div className="grow">
            <Label>Buscar</Label>
            <Input placeholder="Filtrar por nombre, clase, docente o teléfono" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          </div>
          <Badge variant="secondary">{filtrados.length} personas</Badge>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtrados.map((p) => (
            <div key={p.alumnoId} className={`border rounded-xl p-3 ${p.abandono ? "bg-red-50" : "bg-background"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold leading-tight">{p.nombre}</p>
                  <p className="text-[11px] text-muted-foreground">{p.clase} • Docente: {p.docente || "(sin asignar)"}</p>
                  {p.telefono && <p className="text-[11px] text-muted-foreground">📞 {p.telefono}</p>}
                </div>
                <Badge variant={p.abandono ? "destructive" : "secondary"}>
                  {p.porcentaje}%
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                <div className="border rounded-lg p-2">
                  <p className="text-[11px] text-muted-foreground">Última asistencia</p>
                  <p className="font-medium">{p.lastAttendance || "—"}</p>
                </div>
                <div className="border rounded-lg p-2">
                  <p className="text-[11px] text-muted-foreground">Racha de ausencias</p>
                  <p className="font-medium">{p.currentAbsentStreak} semana(s)</p>
                </div>
              </div>
              {p.abandono && (
                <p className="text-xs mt-2 text-red-700">⚠️ Alerta: {p.nombre} lleva {p.currentAbsentStreak} semanas sin asistir.</p>
              )}
            </div>
          ))}
          {filtrados.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No hay personas que coincidan con el filtro.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ================== UI: Configuración ==================
function Configuracion({ state, setState }) {
  function changeDocente(classId, docente) {
    setState((prev) => {
      const p = deepClone(prev);
      const cls = p.clases.find((c) => c.id === classId);
      if (cls) cls.docente = docente;
      p.updatedAt = new Date().toISOString();
      return p;
    });
  }
  function addAlumno(classId, alumno) {
    setState((prev) => {
      const p = deepClone(prev);
      const cls = p.clases.find((c) => c.id === classId);
      if (!cls) return p;
      cls.alumnos.push(alumno);
      p.updatedAt = new Date().toISOString();
      return p;
    });
  }
  function removeAlumno(classId, alumnoId) {
    setState((prev) => {
      const p = deepClone(prev);
      const cls = p.clases.find((c) => c.id === classId);
      if (!cls) return p;
      cls.alumnos = cls.alumnos.filter((a) => a.id !== alumnoId);
      for (const fecha of Object.keys(p.asistencias)) {
        if (p.asistencias[fecha]?.[classId]?.[alumnoId]) {
          delete p.asistencias[fecha][classId][alumnoId];
        }
      }
      p.updatedAt = new Date().toISOString();
      return p;
    });
  }
  function editAlumnoTelefono(classId, alumnoId, telefono) {
    setState((prev) => {
      const p = deepClone(prev);
      const cls = p.clases.find((c) => c.id === classId);
      if (!cls) return p;
      const alumno = cls.alumnos.find((a) => a.id === alumnoId);
      if (alumno) alumno.telefono = telefono;
      p.updatedAt = new Date().toISOString();
      return p;
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><Settings className="w-4 h-4"/> Configuración de clases y docentes</h3>
          <p className="text-sm text-muted-foreground mb-4">Edite el nombre del docente por clase, y agregue o quite alumnos (con teléfono opcional).</p>
          <div className="grid md:grid-cols-2 gap-3">
            {state.clases.map((c) => (
              <ClassCard
                key={c.id}
                clase={c}
                onChangeDocente={changeDocente}
                onAddAlumno={addAlumno}
                onRemoveAlumno={removeAlumno}
                onEditAlumnoTelefono={editAlumnoTelefono}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Copia de seguridad</h4>
            <p className="text-xs text-muted-foreground">Exporte o importe sus datos manualmente (JSON).</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => {
              const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "ibbla_asistencia_backup.json";
              a.click();
              URL.revokeObjectURL(url);
            }}>Exportar</Button>

            <label className="inline-flex">
              <Input type="file" accept="application/json" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const data = ensureStateShape(JSON.parse(String(reader.result)));
                    setState(data);
                  } catch {
                    alert("Archivo no válido.");
                  }
                };
                reader.readAsText(file);
              }} />
              <Button asChild variant="secondary"><span>Importar</span></Button>
            </label>

            <Button variant="destructive" onClick={() => {
              if (!confirm("Esto borrará todos los datos locales (clases, alumnos y asistencias). ¿Continuar?")) return;
              setState(ensureStateShape(null));
            }}>Reiniciar datos</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ================== Panel de Pruebas (Test Cases) ==================
function runStaticTests() {
  const results = [];
  // Test 1: Debe haber 5 clases y IDs únicos
  const ids = DEFAULT_CLASSES.map((c) => c.id);
  const uniqueIds = new Set(ids);
  results.push({ name: "Clases por defecto (5) e IDs únicos", pass: DEFAULT_CLASSES.length === 5 && uniqueIds.size === ids.length });

  // Test 2: deepClone no debe mutar el original
  const o = { a: 1, b: { c: 2 } };
  const oc = deepClone(o);
  oc.b.c = 3;
  results.push({ name: "deepClone no muta el original", pass: o.b.c === 2 });

  // Test 3: ensureStateShape corrige estructuras incompletas
  const shaped = ensureStateShape({});
  results.push({ name: "ensureStateShape agrega claves", pass: Array.isArray(shaped.clases) && typeof shaped.asistencias === "object" && shaped.version >= 1 });

  // Test 4: Serialización estado básica
  const sampleState = ensureStateShape(null);
  try {
    const json = JSON.stringify(sampleState);
    const parsed = ensureStateShape(JSON.parse(json));
    results.push({ name: "Serialización válida", pass: !!parsed && Array.isArray(parsed.clases) && typeof parsed.asistencias === "object" });
  } catch (e) {
    results.push({ name: "Serialización válida", pass: false });
  }

  // Test 5: Registrar asistencia cambia conteo
  const tState = deepClone(sampleState);
  const f = "2025-08-10";
  const classId = DEFAULT_CLASSES[0].id;
  const alumno = { id: "a1", nombre: "Prueba Alumno", telefono: "+506 8888 8888" };
  tState.clases[0].alumnos.push(alumno);
  tState.asistencias[f] = { [classId]: { [alumno.id]: { presente: true } } };
  const presentes = Object.values(tState.asistencias[f][classId]).filter((r) => r.presente).length;
  results.push({ name: "Conteo de presentes", pass: presentes === 1 });

  return results;
}

function TestPanel() {
  const tests = useMemo(() => runStaticTests(), []);
  const passed = tests.filter(t => t.pass).length;
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <h3 className="font-semibold mb-2">Pruebas internas</h3>
        <p className="text-sm text-muted-foreground mb-3">Resultados rápidos para comprobar estructura y operaciones básicas.</p>
        <ul className="space-y-2">
          {tests.map((t, i) => (
            <li key={i} className="flex items-center justify-between border rounded-lg px-3 py-2">
              <span className="text-sm">{t.name}</span>
              <Badge variant={t.pass ? "secondary" : "destructive"}>{t.pass ? "OK" : "FALLÓ"}</Badge>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-3">{passed}/{tests.length} pruebas aprobadas.</p>
      </CardContent>
    </Card>
  );
}

// ================== App ==================
export default function App() {
  const [state, setState] = useState(() => (
    ensureStateShape(loadLocal())
  ));
  const [sync, setSync] = useState({ mode: SYNC_MODE, status: SYNC_MODE === "sheets" ? "idle" : "local" });
  const saveTimer = useRef(null);
  const lastPushedRef = useRef(0);

  // Al montar, si hay backend configurado, cargar del remoto y fusionar
  useEffect(() => {
    if (SYNC_MODE !== "sheets") return;
    let mounted = true;
    (async () => {
      try {
        setSync((s) => ({ ...s, status: "syncing" }));
        const remote = await remoteLoad();
        if (!mounted) return;
        // Estrategia simple: remoto manda si es más reciente
        const local = ensureStateShape(loadLocal());
        const newer = (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;
        setState(ensureStateShape(newer));
        setSync((s) => ({ ...s, status: "synced" }));
      } catch (e) {
        console.warn("Fallo al cargar remoto, continuo en local:", e);
        setSync((s) => ({ ...s, status: "idle" }));
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Guardado local inmediato (cache)
  useEffect(() => { saveLocal(state); }, [state]);

  // Empujar al remoto con debounce si está activo
  useEffect(() => {
    if (SYNC_MODE !== "sheets") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSync((s) => ({ ...s, status: "syncing" }));
        await remoteSave(state);
        lastPushedRef.current = Date.now();
        setSync((s) => ({ ...s, status: "synced" }));
      } catch (e) {
        console.warn("Fallo al guardar remoto:", e);
        setSync((s) => ({ ...s, status: "idle" }));
      }
    }, 800); // 0.8s de debounce
    return () => clearTimeout(saveTimer.current);
  }, [state]);

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <Header sync={sync} />

      <Tabs defaultValue="asistencia" className="mt-2">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="asistencia"><Users className="w-4 h-4 mr-1"/> Tomar asistencia</TabsTrigger>
          <TabsTrigger value="fechas"><LineChart className="w-4 h-4 mr-1"/> Estadísticas por fecha</TabsTrigger>
          <TabsTrigger value="personas"><Check className="w-4 h-4 mr-1"/> Estadísticas por persona</TabsTrigger>
          <TabsTrigger value="config"><Settings className="w-4 h-4 mr-1"/> Configuración</TabsTrigger>
          <TabsTrigger value="tests">🧪 Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="asistencia" className="mt-4">
          <AttendanceTaker state={state} setState={setState} />
        </TabsContent>

        <TabsContent value="fechas" className="mt-4">
          <StatsByDate state={state} />
        </TabsContent>

        <TabsContent value="personas" className="mt-4">
          <StatsByPerson state={state} />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <Configuracion state={state} setState={setState} />
        </TabsContent>

        <TabsContent value="tests" className="mt-4">
          <TestPanel />
        </TabsContent>
      </Tabs>

      <footer className="text-xs text-muted-foreground mt-6">
        <p>
          Consejo: Tome asistencia cada domingo (o día de clase). El sistema detectará automáticamente rachas de ausencia de 3 semanas y resaltará en rojo a esas personas para dar seguimiento.
        </p>
      </footer>

      {/* ================= DOCUMENTACIÓN BACKEND (Apps Script) =================
      1) Cree un Google Sheet vacío (llámelo "IBBLA Asistencia").
      2) En el Sheet, abra Extensiones → Apps Script y pegue este código, GUARDANDO el proyecto:

      function doGet(e) {
        const props = PropertiesService.getDocumentProperties();
        const json = props.getProperty('STATE_JSON');
        const state = json ? JSON.parse(json) : {
          version: 1,
          updatedAt: new Date().toISOString(),
          clases: [
            { id: 'logos', nombre: 'Logos', rango: '18–24 años', docente: '', alumnos: [] },
            { id: 'smart', nombre: 'Smart Class', rango: '25–39 años', docente: '', alumnos: [] },
            { id: 'moriah', nombre: 'Moriah', rango: '40–55 años', docente: '', alumnos: [] },
            { id: 'horeb', nombre: 'Horeb', rango: '56–65 años', docente: '', alumnos: [] },
            { id: 'sabiduria', nombre: 'Sabiduría', rango: '+66 años', docente: '', alumnos: [] },
          ],
          asistencias: {}
        };
        return ContentService.createTextOutput(JSON.stringify(state))
          .setMimeType(ContentService.MimeType.JSON)
          .setHeader('Access-Control-Allow-Origin', '*');
      }

      function doPost(e) {
        const body = JSON.parse(e.postData.contents);
        body.updatedAt = new Date().toISOString();
        const props = PropertiesService.getDocumentProperties();
        props.setProperty('STATE_JSON', JSON.stringify(body));
        return ContentService.createTextOutput(JSON.stringify({ ok: true, updatedAt: body.updatedAt }))
          .setMimeType(ContentService.MimeType.JSON)
          .setHeader('Access-Control-Allow-Origin', '*');
      }

      3) En Apps Script → Implementar → Implementar como aplicación web:
         - Descripción: IBBLA WebApp
         - Ejecutar como: Tú
         - Quién tiene acceso: Cualquiera con el enlace (o restringido a tu dominio si usan cuentas de Google de la iglesia)
         - Copia la URL de despliegue.
      4) Pega la URL en SHEETS_WEBAPP_URL arriba y publica la app (Vercel o local). 
      5) Comparte el mismo enlace de la app a todos los maestros; todo se sincroniza en ese Sheet.

      (Opcional) Puedes crear varios WebApps (uno por clase) si deseas aislar datos.
      ======================================================================= */}
    </div>
  );
}
