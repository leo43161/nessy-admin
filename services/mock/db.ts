// ════════════════════════════════════════════════════════════════
//  BACKEND MOCK — simula la DB real (SQL_21-7) mientras la API
//  está en desarrollo. Los datos se generan RELATIVOS a hoy y con
//  estados coherentes con la fecha de cada cuota:
//    · Pendiente     → fecha futura (aún no vence)
//    · Adelanto      → cuota futura, pagada por adelantado
//    · Pagado        → vencía hoy / hace poco, pagada a tiempo
//    · Recargo       → fecha pasada, cobrada tarde (con recargo)
//    · Incomunicado  → fecha pasada, no se pudo contactar
//  La lista de "cobros del día" es una ventana alrededor de la
//  fecha de trabajo (el worklist del cobrador). Se persiste en
//  localStorage y se re-genera al cambiar de día.
// ════════════════════════════════════════════════════════════════
import { MOCK_DB_KEY } from "@/lib/constants";
import { addDays, todayISO } from "@/lib/format";
import { esCobrado, esVencido } from "@/lib/status";
import type {
  Cliente,
  ClienteListado,
  Cobrador,
  CobroDelDia,
  EstadoDeCuenta,
  EstadoDeCuentaMovimiento,
  EstadoDeCuentaPlan,
  Localidad,
  Nota,
  PagoEstado,
  PagoPorRealizar,
  PagoRealizado,
  PlanDePagos,
  Referente,
  Telefono,
} from "@/types";

// Tabla polimórfica Telefonos: id_tabla apunta al nombre de la tabla dueña
export type TablaTel = "Clientes" | "Cobradores" | "Referentes";

export interface TelefonoRow extends Telefono {
  tabla: TablaTel;
  idEntidad: number;
}

interface CuentaRow {
  id: number;
  nombreDeUsuario: string;
  rol: string;
  /** Roles.id_Roles — 1 admin, 2 cobrador */
  rolId: number;
  /** Cuenta_Cobrador. null en el admin: no cobra, no tiene cartera */
  idCobrador: number | null;
}

export interface MockDb {
  seedDate: string;
  localidades: Localidad[];
  cobradores: Cobrador[];
  cuentas: CuentaRow[];
  clientes: Cliente[];
  referentes: Referente[];
  referenteCliente: Array<{ idReferente: number; idCliente: number }>;
  clienteClienteReferente: Array<{ idTitular: number; idReferente: number }>;
  telefonos: TelefonoRow[];
  clienteCobrador: Array<{ idCliente: number; idCobrador: number }>;
  cuentasCorrientes: Array<{ id: number; idCliente: number }>;
  planes: PlanDePagos[];
  pagosPorRealizar: PagoPorRealizar[];
  pagosRealizados: PagoRealizado[];
  notas: Nota[];
}

// ── Datos maestros ──

const LOCALIDADES: Localidad[] = [
  { id: 1, nombre: "San Miguel Centro" },
  { id: 2, nombre: "Yerba Buena" },
  { id: 3, nombre: "Tafí Viejo" },
  { id: 4, nombre: "Banda del Río Salí" },
  { id: 5, nombre: "Alderetes" },
];

const persona = (
  id: number,
  dni: string,
  nombreCompleto: string,
  idLocalidad: number,
  direccion: string,
) => ({
  id,
  dni,
  nombreCompleto,
  email: `${nombreCompleto.split(" ")[0].toLowerCase()}@mail.com`,
  codigoPostal: "4000",
  direccion,
  casaODeptoDirecc1: null,
  direccionLaboralOAlternativa: null,
  casaODeptoDirecc2: null,
  img: null,
  fechaDeNacimiento: "1985-06-15",
  idLocalidad,
});

const COBRADORES: Cobrador[] = [
  persona(1, "28111222", "Marcos Gutiérrez", 1, "Av. Sarmiento 450"),
  persona(2, "30333444", "Luis Fernández", 2, "Av. Aconquija 1200"),
  persona(3, "32555666", "Diego Ponce", 4, "Belgrano 890"),
];

const CUENTAS: CuentaRow[] = [
  { id: 1, nombreDeUsuario: "admin", rol: "Admin", rolId: 1, idCobrador: null },
  { id: 2, nombreDeUsuario: "marcos", rol: "Cobrador", rolId: 2, idCobrador: 1 },
  { id: 3, nombreDeUsuario: "luis", rol: "Cobrador", rolId: 2, idCobrador: 2 },
  { id: 4, nombreDeUsuario: "diego", rol: "Cobrador", rolId: 2, idCobrador: 3 },
];

const cliente = (
  id: number,
  dni: string,
  nombre: string,
  idLocalidad: number,
  direccion: string,
  ubicacionCobro: string,
  status: Cliente["status"] = "Activo",
): Cliente => ({
  ...persona(id, dni, nombre, idLocalidad, direccion),
  ubicacionCobro,
  status,
});

const CLIENTES: Cliente[] = [
  cliente(1, "25111001", "Ana García", 1, "San Martín 1520", "Local · San Martín 1520"),
  cliente(2, "24111002", "Carlos Rodríguez", 1, "Córdoba 733", "Casa · Córdoba 733", "Moroso"),
  cliente(3, "26111003", "Sofia Méndez", 2, "Perú 2210", "Kiosco · Perú 2210"),
  cliente(4, "27111004", "Roberto Álvarez", 1, "Junín 340", "Taller · Junín 340"),
  cliente(5, "28111005", "Mariela Sánchez", 2, "Marcos Paz 1105", "Casa · Marcos Paz 1105"),
  cliente(6, "23111006", "Jorge Pereyra", 3, "Av. Alem 77", "Casa · Av. Alem 77", "Moroso"),
  cliente(7, "29111007", "Claudia Torres", 1, "Muñecas 980", "Local · Muñecas 980"),
  cliente(8, "22111008", "Nelson Ríos", 4, "Ruta 302 km 3", "Casa · Ruta 302 km 3", "Moroso"),
  cliente(9, "30111009", "Valeria Gómez", 2, "Salta 466", "Farmacia · Salta 466"),
  cliente(10, "26111010", "Héctor Villalba", 4, "Colón 155", "Casa · Colón 155"),
  cliente(11, "27111011", "Patricia Aguirre", 5, "Lavalle 2300", "Almacén · Lavalle 2300"),
  cliente(12, "24111012", "Daniel Herrera", 4, "Av. Roca 1780", "Casa · Av. Roca 1780", "Moroso"),
  cliente(13, "28111013", "Graciela Luna", 5, "Mendoza 890", "Casa · Mendoza 890"),
  cliente(
    14,
    "23111014",
    "Marcelo Benítez",
    2,
    "9 de Julio 121",
    "Gomería · 9 de Julio 121",
    "Moroso",
  ),
  cliente(15, "29111015", "Silvia Romero", 3, "Italia 655", "Casa · Italia 655"),
  cliente(
    16,
    "25111016",
    "Gustavo Medina",
    4,
    "Av. Independencia 2044",
    "Local · Independencia 2044",
  ),
  cliente(17, "30111017", "Laura Ibáñez", 5, "Rivadavia 310", "Casa · Rivadavia 310"),
  cliente(
    18,
    "22111018",
    "Ricardo Juárez",
    4,
    "Av. América 1500",
    "Verdulería · América 1500",
    "Moroso",
  ),
  cliente(19, "27111019", "Fernanda Cabrera", 3, "Las Heras 720", "Casa · Las Heras 720"),
  cliente(20, "24111020", "Pablo Mansilla", 5, "Uruguay 1888", "Casa · Uruguay 1888", "Moroso"),
  cliente(21, "28111021", "Mónica Reynoso", 3, "Chacabuco 415", "Mercería · Chacabuco 415"),
];

const REFERENTES: Referente[] = [
  persona(1, "20999001", "Elsa Domínguez", 1, "San Juan 1200"),
  persona(2, "21999002", "Raúl Paz", 2, "Av. Perón 3300"),
  persona(3, "19999003", "Norma Suárez", 3, "Bolívar 540"),
  persona(4, "22999004", "Oscar Leiva", 4, "Av. Roca 220"),
  persona(5, "23999005", "Marta Quiroga", 5, "Sargento Cabral 65"),
  persona(6, "20999006", "Hugo Barraza", 1, "Catamarca 909"),
];

const REFERENTE_CLIENTE = [
  { idReferente: 1, idCliente: 1 },
  { idReferente: 2, idCliente: 2 },
  { idReferente: 3, idCliente: 6 },
  { idReferente: 4, idCliente: 8 },
  { idReferente: 5, idCliente: 11 },
  { idReferente: 6, idCliente: 4 },
  { idReferente: 2, idCliente: 14 },
  { idReferente: 4, idCliente: 18 },
];

const CLIENTE_CLIENTE_REFERENTE = [
  { idTitular: 4, idReferente: 1 },
  { idTitular: 5, idReferente: 3 },
  { idTitular: 2, idReferente: 1 },
  { idTitular: 20, idReferente: 16 },
];

let telId = 1;
const tel = (tabla: TablaTel, idEntidad: number, numero: string): TelefonoRow => ({
  id: telId++,
  tabla,
  idEntidad,
  numero,
});

const TELEFONOS: TelefonoRow[] = [
  tel("Cobradores", 1, "3811110001"),
  tel("Cobradores", 2, "3811110002"),
  tel("Cobradores", 3, "3811110003"),
  tel("Clientes", 1, "3812220001"),
  tel("Clientes", 1, "3814440001"),
  tel("Clientes", 2, "3812220002"),
  tel("Clientes", 2, "3814440002"),
  tel("Clientes", 3, "3812220003"),
  tel("Clientes", 4, "3815010101"),
  tel("Clientes", 5, "3815020202"),
  tel("Clientes", 6, "3815030303"),
  tel("Clientes", 6, "3814330303"),
  tel("Clientes", 7, "3815040404"),
  tel("Clientes", 8, "3815050505"),
  tel("Clientes", 8, "3814550505"),
  tel("Clientes", 9, "3815060606"),
  tel("Clientes", 10, "3815070707"),
  tel("Clientes", 11, "3815080808"),
  tel("Clientes", 12, "3815090909"),
  tel("Clientes", 13, "3815101010"),
  tel("Clientes", 14, "3815111111"),
  tel("Clientes", 14, "3814111111"),
  tel("Clientes", 15, "3815121212"),
  tel("Clientes", 16, "3815131313"),
  tel("Clientes", 17, "3815141414"),
  tel("Clientes", 18, "3815151515"),
  tel("Clientes", 19, "3815161616"),
  tel("Clientes", 20, "3815171717"),
  tel("Clientes", 21, "3815181818"),
  tel("Referentes", 1, "3816660001"),
  tel("Referentes", 2, "3816660002"),
  tel("Referentes", 3, "3816660003"),
  tel("Referentes", 4, "3816660004"),
  tel("Referentes", 5, "3816660005"),
  tel("Referentes", 6, "3816660006"),
];

// Asignación cliente → cobrador (7 clientes por cobrador)
const CLIENTE_COBRADOR = [
  { idCliente: 1, idCobrador: 1 },
  { idCliente: 4, idCobrador: 1 },
  { idCliente: 5, idCobrador: 1 },
  { idCliente: 6, idCobrador: 1 },
  { idCliente: 7, idCobrador: 1 },
  { idCliente: 8, idCobrador: 1 },
  { idCliente: 9, idCobrador: 1 },
  { idCliente: 2, idCobrador: 2 },
  { idCliente: 10, idCobrador: 2 },
  { idCliente: 11, idCobrador: 2 },
  { idCliente: 12, idCobrador: 2 },
  { idCliente: 13, idCobrador: 2 },
  { idCliente: 14, idCobrador: 2 },
  { idCliente: 15, idCobrador: 2 },
  { idCliente: 3, idCobrador: 3 },
  { idCliente: 16, idCobrador: 3 },
  { idCliente: 17, idCobrador: 3 },
  { idCliente: 18, idCobrador: 3 },
  { idCliente: 19, idCobrador: 3 },
  { idCliente: 20, idCobrador: 3 },
  { idCliente: 21, idCobrador: 3 },
];

// Monto de la cuota (por cliente / su plan activo)
const CUOTA_MONTO: Record<number, number> = {
  1: 25000,
  2: 31250,
  3: 31250,
  4: 15000,
  5: 10000,
  6: 20000,
  7: 12500,
  8: 25000,
  9: 8000,
  10: 17500,
  11: 12000,
  12: 22500,
  13: 14000,
  14: 27500,
  15: 10500,
  16: 16000,
  17: 11500,
  18: 24000,
  19: 13500,
  20: 26000,
  21: 9500,
};

const cobradorDe = (clienteId: number) =>
  CLIENTE_COBRADOR.find((cc) => cc.idCliente === clienteId)?.idCobrador ?? 1;

const NOMBRES_PLAN = [
  "Préstamo personal",
  "Financiación mercadería",
  "Financiación electro",
  "Crédito rápido",
];

// Cuenta corriente 1:1 con cliente (ids iguales para simplificar)
const CUENTAS_CORRIENTES = CLIENTES.map((c) => ({ id: c.id, idCliente: c.id }));

// Planes: uno activo por cliente (id de plan = id de cliente) + planes extra
// para los primeros clientes (enriquecen el estado de cuenta con historial).
const PLANES: PlanDePagos[] = [
  ...CLIENTES.map<PlanDePagos>((c) => ({
    id: c.id,
    idCuentaCorriente: c.id,
    nombre: NOMBRES_PLAN[c.id % NOMBRES_PLAN.length],
    montoTotal: CUOTA_MONTO[c.id] * 16,
    status: "Activo",
  })),
  {
    id: 22,
    idCuentaCorriente: 1,
    nombre: "Financiación mercadería (saldada)",
    montoTotal: 200000,
    status: "Completado",
  },
  {
    id: 23,
    idCuentaCorriente: 2,
    nombre: "Financiación electro",
    montoTotal: 250000,
    status: "Incumplido",
  },
  {
    id: 24,
    idCuentaCorriente: 3,
    nombre: "Refinanciación anterior",
    montoTotal: 187500,
    status: "Refinanciado",
  },
];

// ── Generación de cuotas (coherentes con la fecha) ──

const CONCEPTOS: Record<PagoEstado, string> = {
  Pagado: "Cuota cobrada",
  Adelanto: "Pago adelantado",
  Recargo: "Pago con recargo",
  Incomunicado: "Cliente incomunicado",
  Pendiente: "Cuota pendiente",
};

// Offsets (días respecto a hoy) por estado, coherentes con su significado
const OFFSETS: Record<PagoEstado, number[]> = {
  Pagado: [0, -1, -2, -9], // vence hoy/hace poco, pagada a tiempo
  Pendiente: [1, 2, 4, 5], // vence en el futuro, sin cobrar
  Adelanto: [3, 6, 7], // vence en el futuro, pero pagada por adelantado
  Recargo: [-3, -4, -6], // venció, cobrada tarde con recargo
  Incomunicado: [-5, -7, -8], // venció, no se pudo contactar
};

// Distribución por cobrador. Marcos (1) = 3 de cada estado.
// Luis (2) y Diego (3) varían levemente para un ranking con orden claro.
const COUNTS: Record<number, Record<PagoEstado, number>> = {
  1: { Pagado: 3, Pendiente: 3, Adelanto: 3, Recargo: 3, Incomunicado: 3 },
  2: { Pagado: 4, Pendiente: 2, Adelanto: 3, Recargo: 3, Incomunicado: 3 },
  3: { Pagado: 2, Pendiente: 4, Adelanto: 3, Recargo: 3, Incomunicado: 3 },
};

const GEN_ORDER: PagoEstado[] = ["Pagado", "Pendiente", "Adelanto", "Recargo", "Incomunicado"];

// Asistencias: cuotas cobradas por otro cobrador (quedan "fuera de rango")
const ASISTENCIAS: Array<{ cobrador: number; estado: PagoEstado; k: number; cubre: number }> = [
  { cobrador: 1, estado: "Recargo", k: 0, cubre: 3 }, // Diego cubrió a Marcos
  { cobrador: 2, estado: "Pagado", k: 0, cubre: 1 }, // Marcos cubrió a Luis
];

/** Día en que se registró el pago, coherente con el estado */
function paidOffset(estado: PagoEstado, due: number): number | null {
  switch (estado) {
    case "Pagado":
      return due; // a tiempo
    case "Adelanto":
      return 0; // pagada hoy, por adelantado
    case "Recargo":
      return Math.min(due + 2, 0); // pagada tarde (en el pasado)
    default:
      return null; // Pendiente / Incomunicado: sin pago
  }
}

function seedDb(): MockDb {
  const pagosPorRealizar: PagoPorRealizar[] = [];
  const pagosRealizados: PagoRealizado[] = [];
  let ppId = 1;
  let prId = 1;

  const addCuota = (
    planId: number,
    monto: number,
    dueOffset: number,
    estado: PagoEstado,
    idCobradorPago: number,
    fueraDeRango: boolean,
  ) => {
    const registrado = estado !== "Pendiente";
    const pp: PagoPorRealizar = {
      id: ppId++,
      idPlanDePago: planId,
      fechaAcordada: addDays(dueOffset),
      montoEsperado: monto,
      dentroRango: registrado ? !fueraDeRango : null,
      estado,
    };
    pagosPorRealizar.push(pp);
    const paid = paidOffset(estado, dueOffset);
    if (paid !== null) {
      pagosRealizados.push({
        id: prId++,
        idPago: pp.id,
        idCobrador: idCobradorPago,
        concepto: CONCEPTOS[estado],
        fechaDePago: addDays(paid),
      });
    }
    return pp;
  };

  // Worklist balanceado por cobrador, repartido entre sus clientes
  for (const cobrador of [1, 2, 3]) {
    const clientes = CLIENTE_COBRADOR.filter((cc) => cc.idCobrador === cobrador).map(
      (cc) => cc.idCliente,
    );
    let ci = 0;
    for (const estado of GEN_ORDER) {
      const n = COUNTS[cobrador][estado];
      for (let k = 0; k < n; k++) {
        const clienteId = clientes[ci % clientes.length];
        ci++;
        const asis = ASISTENCIAS.find(
          (a) => a.cobrador === cobrador && a.estado === estado && a.k === k,
        );
        addCuota(
          clienteId, // plan activo id = cliente id
          CUOTA_MONTO[clienteId],
          OFFSETS[estado][k],
          estado,
          asis ? asis.cubre : cobrador,
          Boolean(asis),
        );
      }
    }
  }

  // Historial de cuotas pagadas por plan activo (fuera de la ventana visible;
  // enriquecen el estado de cuenta)
  for (const c of CLIENTES) {
    for (const off of [-16, -23]) {
      addCuota(c.id, CUOTA_MONTO[c.id], off, "Pagado", cobradorDe(c.id), false);
    }
  }

  // Planes extra con su propio historial
  const EXTRA: Array<{ plan: number; monto: number; offs: number[] }> = [
    { plan: 22, monto: 25000, offs: [-30, -37, -44, -51, -58] },
    { plan: 23, monto: 31250, offs: [-30, -37, -44] },
    { plan: 24, monto: 31250, offs: [-30, -37, -44, -51] },
  ];
  const clienteDePlan = (planId: number) => PLANES.find((p) => p.id === planId)!.idCuentaCorriente;
  for (const e of EXTRA) {
    for (const off of e.offs) {
      addCuota(e.plan, e.monto, off, "Pagado", cobradorDe(clienteDePlan(e.plan)), false);
    }
  }

  const notas: Nota[] = [
    {
      id: 1,
      idCliente: 6,
      nota: "No estaba en su casa. La vecina dice que vuelve a la tarde. Pasar de nuevo después de las 18hs.",
      fechaDeCreacion: addDays(-1),
      fechaUltimaEdicion: null,
    },
    {
      id: 2,
      idCliente: 8,
      nota: "Prometió ponerse al día el sábado con dos cuotas juntas. Insistir si no aparece.",
      fechaDeCreacion: addDays(-2),
      fechaUltimaEdicion: null,
    },
    {
      id: 3,
      idCliente: 2,
      nota: "Cambió de trabajo, ahora cobra los días 5. Pedirle la cuota después de esa fecha.",
      fechaDeCreacion: addDays(-4),
      fechaUltimaEdicion: addDays(-3),
    },
  ];

  return {
    seedDate: todayISO(),
    localidades: structuredClone(LOCALIDADES),
    cobradores: structuredClone(COBRADORES),
    cuentas: structuredClone(CUENTAS),
    clientes: structuredClone(CLIENTES),
    referentes: structuredClone(REFERENTES),
    referenteCliente: structuredClone(REFERENTE_CLIENTE),
    clienteClienteReferente: structuredClone(CLIENTE_CLIENTE_REFERENTE),
    telefonos: structuredClone(TELEFONOS),
    clienteCobrador: structuredClone(CLIENTE_COBRADOR),
    cuentasCorrientes: structuredClone(CUENTAS_CORRIENTES),
    planes: structuredClone(PLANES),
    pagosPorRealizar,
    pagosRealizados,
    notas,
  };
}

// ── Acceso / persistencia ──

let cache: MockDb | null = null;

export function getDb(): MockDb {
  if (cache) return cache;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(MOCK_DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDb;
        // Datos relativos al día: si cambió la fecha, re-sembramos
        if (parsed.seedDate === todayISO() && parsed.localidades) {
          cache = parsed;
          return cache;
        }
      }
    } catch {
      // seed limpio ante datos corruptos
    }
  }
  cache = seedDb();
  saveDb();
  return cache;
}

export function saveDb(): void {
  if (cache && typeof window !== "undefined") {
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(cache));
  }
}

export function nextId(items: Array<{ id: number }>): number {
  return items.reduce((max, i) => Math.max(max, i.id), 0) + 1;
}

/** Simula la latencia de red de la API real */
export function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// ── Consultas compartidas (lo que harían los stored procedures) ──

export function getTelefonos(db: MockDb, tabla: TablaTel, idEntidad: number): Telefono[] {
  return db.telefonos
    .filter((t) => t.tabla === tabla && t.idEntidad === idEntidad)
    .map(({ id, numero }) => ({ id, numero }));
}

export function getLocalidadNombre(db: MockDb, id: number | null): string | null {
  return db.localidades.find((l) => l.id === id)?.nombre ?? null;
}

export function getCobradorDeCliente(db: MockDb, idCliente: number) {
  const rel = db.clienteCobrador.find((cc) => cc.idCliente === idCliente);
  return rel ? (db.cobradores.find((c) => c.id === rel.idCobrador) ?? null) : null;
}

export function toClienteListado(db: MockDb, c: Cliente): ClienteListado {
  const cobrador = getCobradorDeCliente(db, c.id);
  return {
    id: c.id,
    dni: c.dni,
    nombreCompleto: c.nombreCompleto,
    status: c.status,
    direccion: c.direccion,
    ubicacionCobro: c.ubicacionCobro,
    idLocalidad: c.idLocalidad,
    localidadNombre: getLocalidadNombre(db, c.idLocalidad),
    telefonos: getTelefonos(db, "Clientes", c.id),
    cobradorAsignadoId: cobrador?.id ?? null,
    cobradorAsignadoNombre: cobrador?.nombreCompleto ?? null,
  };
}

/** Une un pago por realizar con su plan, cliente y cobradores → CobroDelDia */
export function toCobroDelDia(db: MockDb, pp: PagoPorRealizar): CobroDelDia | null {
  const planDePago = db.planes.find((p) => p.id === pp.idPlanDePago);
  if (!planDePago) return null;
  const cc = db.cuentasCorrientes.find((c) => c.id === planDePago.idCuentaCorriente);
  const clienteRow = db.clientes.find((c) => c.id === cc?.idCliente);
  if (!clienteRow) return null;
  const asignado = getCobradorDeCliente(db, clienteRow.id);
  const realizado = db.pagosRealizados.find((pr) => pr.idPago === pp.id);
  const cobradoPor = realizado
    ? (db.cobradores.find((c) => c.id === realizado.idCobrador) ?? null)
    : null;
  return {
    id: pp.id,
    planId: planDePago.id,
    planNombre: planDePago.nombre,
    fechaAcordada: pp.fechaAcordada,
    montoEsperado: pp.montoEsperado,
    estado: pp.estado,
    dentroRango: pp.dentroRango,
    cobradorAsignadoId: asignado?.id ?? 0,
    cobradorAsignadoNombre: asignado?.nombreCompleto ?? "—",
    cobradoPorId: cobradoPor?.id ?? null,
    cobradoPorNombre: cobradoPor?.nombreCompleto ?? null,
    cliente: toClienteListado(db, clienteRow),
  };
}

/**
 * Cuotas cuya fecha acordada cae dentro del rango, inclusive en ambos
 * extremos. Es la consulta base de Operaciones y Cierre; equivale a
 * `sp_Ver-PagoPorRealizar` filtrando por fecha.
 */
export function cobrosEnRango(db: MockDb, desde: string, hasta: string): CobroDelDia[] {
  return db.pagosPorRealizar
    .filter((pp) => pp.fechaAcordada >= desde && pp.fechaAcordada <= hasta)
    .map((pp) => toCobroDelDia(db, pp))
    .filter((c): c is CobroDelDia => c !== null)
    .sort((a, b) => a.fechaAcordada.localeCompare(b.fechaAcordada));
}

/** Histórico completo, sin filtro de fecha (lo que consume Análisis) */
export function todosLosCobros(db: MockDb): CobroDelDia[] {
  return db.pagosPorRealizar
    .map((pp) => toCobroDelDia(db, pp))
    .filter((c): c is CobroDelDia => c !== null);
}

/** Arma el estado de cuenta completo de un cliente */
export function buildEstadoDeCuenta(db: MockDb, clienteId: number): EstadoDeCuenta {
  const clienteRow = db.clientes.find((c) => c.id === clienteId);
  const hoy = todayISO();
  const misCC = db.cuentasCorrientes.filter((cc) => cc.idCliente === clienteId).map((cc) => cc.id);
  const misPlanes = db.planes.filter((p) => misCC.includes(p.idCuentaCorriente));

  const planes: EstadoDeCuentaPlan[] = misPlanes.map((p) => {
    const cuotas = db.pagosPorRealizar.filter((pp) => pp.idPlanDePago === p.id);
    const cobradas = cuotas.filter((c) => esCobrado(c.estado));
    const pagado = cobradas.reduce((s, c) => s + c.montoEsperado, 0);
    const vencidas = cuotas.filter((c) => esVencido(c.estado, c.fechaAcordada, hoy));
    const proxima = cuotas
      .filter((c) => c.estado === "Pendiente" && c.fechaAcordada >= hoy)
      .sort((a, b) => a.fechaAcordada.localeCompare(b.fechaAcordada))[0];

    const movimientos: EstadoDeCuentaMovimiento[] = cuotas
      .filter((c) => c.estado !== "Pendiente")
      .sort((a, b) => b.fechaAcordada.localeCompare(a.fechaAcordada))
      .slice(0, 8)
      .map((c) => {
        const realizado = db.pagosRealizados.find((pr) => pr.idPago === c.id);
        return {
          fecha: realizado?.fechaDePago ?? c.fechaAcordada,
          concepto: realizado?.concepto ?? c.estado,
          monto: c.montoEsperado,
          estado: c.estado,
        };
      });

    return {
      planId: p.id,
      nombre: p.nombre,
      status: p.status,
      montoTotal: p.montoTotal,
      cuotasTotales: cuotas.length,
      cuotasPagadas: cobradas.length,
      pagado,
      pendiente: Math.max(0, p.montoTotal - pagado),
      vencido: vencidas.reduce((s, c) => s + c.montoEsperado, 0),
      proximaCuota: proxima ? { fecha: proxima.fechaAcordada, monto: proxima.montoEsperado } : null,
      movimientos,
    };
  });

  return {
    clienteId,
    clienteNombre: clienteRow?.nombreCompleto ?? "Cliente",
    generadoEl: hoy,
    planes,
    totalPagado: planes.reduce((s, p) => s + p.pagado, 0),
    saldoPendiente: planes
      .filter((p) => p.status === "Activo")
      .reduce((s, p) => s + p.pendiente, 0),
    totalVencido: planes.reduce((s, p) => s + p.vencido, 0),
  };
}
