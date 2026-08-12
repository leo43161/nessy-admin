import { Document, Image, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { fmtMoney, formatFecha } from "@/lib/format";
import { calcularCumplimiento } from "@/lib/cumplimiento";
import { EMPRESA_LOGO, EMPRESA_NOMBRE, EMPRESA_PIE } from "@/lib/marca";
import type { EstadoDeCuenta, EstadoDeCuentaPlan } from "@/types";

// El nombre y el logo salen de `lib/marca.ts`: es el único archivo que hay que
// tocar para cambiarlos, acá y en la app del cobrador.

/** Datos del cliente que no vienen en EstadoDeCuenta pero sí en el encabezado */
export interface EstadoCuentaPdfCliente {
  nombreCompleto: string;
  dni: string;
  direccion: string | null;
  localidadNombre: string | null;
  codigoPostal?: string | null;
}

/**
 * Mensaje institucional del bloque superior (el banco pone su promo acá).
 * Viene de Plantillas_de_mensaje.Mensaje; esto es el fallback hasta que exista la API.
 */
const LEYENDA_DEFAULT = `Gracias por mantener tu plan al día.\n${EMPRESA_PIE}`;

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 54,
    paddingHorizontal: 34,
    fontFamily: "Courier",
    fontSize: 7,
    color: "#000",
  },

  // ── Encabezado ──
  encabezado: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoImg: { width: 30, height: 30, objectFit: "contain" },
  logo: { fontFamily: "Helvetica-Bold", fontSize: 19, color: "#0d4f8b", letterSpacing: -0.4 },

  // Comportamiento de pago
  cumplimiento: { marginTop: 18, borderWidth: 0.7, borderColor: "#0d4f8b", padding: 8 },
  cumplimientoTitulo: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#0d4f8b" },
  cumplimientoFila: { flexDirection: "row", justifyContent: "space-between", marginTop: 3 },
  cumplimientoLabel: { fontSize: 7.5 },
  cumplimientoValor: { fontFamily: "Helvetica-Bold", fontSize: 7.5 },
  advertenciaFila: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  advertenciaTexto: { fontSize: 7, color: "#8b1a1a" },
  paginaBox: { position: "absolute", top: 34, right: 34, alignItems: "flex-end" },
  paginaLabel: { fontSize: 7 },

  destinatario: { marginTop: 46, flexDirection: "row", justifyContent: "space-between" },
  srEs: { fontSize: 7 },
  bloqueDir: { marginLeft: 28, marginTop: 2 },
  nombreDest: { fontFamily: "Courier-BoldOblique", fontSize: 8.5 },
  lineaDir: { fontFamily: "Courier-BoldOblique", fontSize: 8.5 },
  docLinea: { marginTop: 6, marginLeft: 10, fontSize: 7 },

  rule: { borderBottomWidth: 0.8, borderBottomColor: "#000" },
  ruleFina: { borderBottomWidth: 0.5, borderBottomColor: "#000" },

  leyenda: { marginVertical: 14, alignItems: "center" },
  leyendaTxt: { fontFamily: "Courier-Bold", fontSize: 7.5, textAlign: "center", lineHeight: 1.5 },

  // ── Barra de estado de cuenta ──
  barra: { flexDirection: "row", marginTop: 10, marginBottom: 8 },
  barraTxt: { fontSize: 6.6 },

  // ── Cabecera de plan ──
  planTitulo: { marginTop: 10, fontSize: 6.8 },
  resumenHead: { flexDirection: "row", marginTop: 7 },
  resumenRow: { flexDirection: "row", marginTop: 2 },
  planRef: { marginTop: 9, fontSize: 6.6 },

  // ── Tabla de movimientos ──
  tablaHead: { flexDirection: "row", marginTop: 8, marginBottom: 3 },
  fila: { flexDirection: "row", paddingVertical: 0.9 },
  cFecha: { width: "10%" },
  cConcepto: { width: "31%" },
  cCuota: { width: "7%", textAlign: "right", paddingRight: 6 },
  cVenc: { width: "11%" },
  cDebito: { width: "13.5%", textAlign: "right" },
  cCredito: { width: "13.5%", textAlign: "right" },
  cSaldo: { width: "14%", textAlign: "right" },

  // ── Totales ──
  totales: { marginTop: 12 },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 },
  totalLabel: { fontFamily: "Courier-Bold", fontSize: 7.2, width: 150, textAlign: "right" },
  totalValor: { fontFamily: "Courier-Bold", fontSize: 7.2, width: 95, textAlign: "right" },
  vencido: { color: "#a11" },

  // ── Pie ──
  footer: {
    position: "absolute",
    bottom: 22,
    left: 34,
    right: 34,
    fontFamily: "Helvetica-Bold",
    fontSize: 6.2,
    textAlign: "center",
    color: "#000",
    lineHeight: 1.45,
  },
});

/** "2026-07-28" → "28/07/26" (formato compacto de la tabla, como el resumen bancario) */
function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/** Referencia del comprobante: "4897C20260728" (cliente + fecha de emisión) */
function comprobante(ec: EstadoDeCuenta): string {
  return `${ec.clienteId}C${ec.generadoEl.slice(0, 10).replace(/-/g, "")}`;
}

/** Importe sin el "$": la columna ya está rotulada. "45000" → "45.000,00" */
function num(monto: number): string {
  return fmtMoney(monto).replace("$ ", "");
}

/**
 * Movimientos del plan como asiento contable con saldo corrido, al estilo del
 * resumen bancario: el plan nace como débito por el monto total y cada cobro
 * lo acredita. El saldo final coincide con `plan.pendiente`.
 */
interface Asiento {
  fecha: string;
  concepto: string;
  cuota: string;
  vencimiento: string;
  debito: number | null;
  credito: number | null;
  saldo: number;
}

function asientosDelPlan(plan: EstadoDeCuentaPlan): Asiento[] {
  // Un extracto va del movimiento más viejo al más nuevo, y el saldo corrido
  // solo tiene sentido en ese orden.
  //
  // Antes se hacía `.reverse()` dando por sentado que la API los mandaba del
  // más nuevo al más viejo. No es así: el asiento salía al revés y el "ALTA
  // PLAN" quedaba fechado con la ÚLTIMA cuota — una fecha futura, como si el
  // plan hubiera empezado el día que vence lo que todavía no se pagó.
  // Se ordena por fecha en vez de suponer.
  const cronologico = [...plan.movimientos].sort((a, b) =>
    (a.fecha ?? "").localeCompare(b.fecha ?? ""),
  );

  const filas: Asiento[] = [
    {
      fecha: "00/00/00",
      concepto: "SALDO ANTERIOR",
      cuota: "",
      vencimiento: "",
      debito: null,
      credito: null,
      saldo: 0,
    },
    {
      fecha: fechaCorta(cronologico[0]?.fecha),
      concepto: `ALTA PLAN ${plan.nombre.toUpperCase()}`,
      cuota: "",
      vencimiento: "",
      debito: plan.montoTotal,
      credito: null,
      saldo: plan.montoTotal,
    },
  ];

  let saldo = plan.montoTotal;

  cronologico.forEach((m, i) => {
    // Un movimiento de Recargo es un débito (una advertencia con monto), no
    // un crédito: nunca resta del saldo.
    const cobrado = m.estado === "Pagado";
    if (cobrado) saldo -= m.monto;
    filas.push({
      fecha: fechaCorta(m.fecha),
      concepto: m.concepto.toUpperCase(),
      cuota: String(i + 1),
      vencimiento: fechaCorta(m.fecha),
      debito: null,
      credito: cobrado ? m.monto : null,
      saldo,
    });
  });

  if (plan.proximaCuota) {
    filas.push({
      fecha: "",
      concepto: "PROXIMA CUOTA A VENCER",
      cuota: String(plan.cuotasPagadas + 1),
      vencimiento: fechaCorta(plan.proximaCuota.fecha),
      debito: plan.proximaCuota.monto,
      credito: null,
      saldo,
    });
  }

  return filas;
}

function PlanSection({ plan }: { plan: EstadoDeCuentaPlan }) {
  const filas = asientosDelPlan(plan);

  return (
    <View>
      <Text style={styles.planTitulo}>
        PLAN DE PAGOS - {plan.nombre.toUpperCase()} - {plan.status.toUpperCase()}
      </Text>

      {/* Cabecera de cuenta: PLAN / CUOTAS / MDA / SALDO */}
      <View style={styles.resumenHead}>
        <Text style={{ width: "10%" }}>PLAN</Text>
        <Text style={{ width: "12%" }}>CUOTAS</Text>
        <Text style={{ width: "8%" }}>MDA</Text>
        <Text style={{ width: "20%", textAlign: "right" }}>SALDO</Text>
      </View>
      <View style={styles.resumenRow}>
        <Text style={{ width: "10%" }}>{plan.planId}</Text>
        <Text style={{ width: "12%" }}>
          {plan.cuotasPagadas}/{plan.cuotasTotales}
        </Text>
        <Text style={{ width: "8%" }}>$</Text>
        <Text style={{ width: "20%", textAlign: "right" }}>{num(plan.pendiente)}</Text>
      </View>

      <Text style={styles.planRef}>
        PLAN Nº {plan.planId} MONTO TOTAL: {num(plan.montoTotal)} CUOTAS: {plan.cuotasTotales}
        {plan.vencido > 0 ? `  VENCIDO: ${num(plan.vencido)}` : ""}
      </Text>

      {/* ponytail: si un plan supera ~45 cuotas la tabla se parte y la 2da página
          queda sin esta cabecera. `fixed` no sirve: la repite en todas las páginas,
          incluso sobre planes que ya traen la suya. Si aparecen planes tan largos,
          paginar los movimientos a mano por alto de página. */}
      <View style={styles.tablaHead}>
        <Text style={styles.cFecha}>FECHA</Text>
        <Text style={styles.cConcepto}>CONCEPTO</Text>
        <Text style={styles.cCuota}>CUOTA</Text>
        <Text style={styles.cVenc}>VENCIM.</Text>
        <Text style={styles.cDebito}>DEBITOS</Text>
        <Text style={styles.cCredito}>CREDITOS</Text>
        <Text style={styles.cSaldo}>SALDO</Text>
      </View>

      {filas.map((f, i) => (
        <View key={i} style={styles.fila} wrap={false}>
          <Text style={styles.cFecha}>{f.fecha}</Text>
          <Text style={styles.cConcepto}>{f.concepto}</Text>
          <Text style={styles.cCuota}>{f.cuota}</Text>
          <Text style={styles.cVenc}>{f.vencimiento}</Text>
          <Text style={styles.cDebito}>{f.debito == null ? "" : num(f.debito)}</Text>
          <Text style={styles.cCredito}>{f.credito == null ? "" : num(f.credito)}</Text>
          <Text style={styles.cSaldo}>{num(f.saldo)}</Text>
        </View>
      ))}
    </View>
  );
}

export function EstadoCuentaDocument({
  ec,
  cliente,
  leyenda = LEYENDA_DEFAULT,
}: {
  ec: EstadoDeCuenta;
  cliente: EstadoCuentaPdfCliente;
  /** Plantillas_de_mensaje.Mensaje — una línea por salto de línea */
  leyenda?: string;
}) {
  const domicilio = [cliente.codigoPostal, cliente.localidadNombre].filter(Boolean).join(" ");
  const lineasLeyenda = leyenda.split("\n").filter((l) => l.trim() !== "");
  const cumplimiento = calcularCumplimiento(ec, ec.generadoEl);

  return (
    <Document
      title={`Estado de cuenta ${cliente.nombreCompleto}`}
      author={EMPRESA_NOMBRE}
      subject="Estado de cuenta unificado"
    >
      <Page size="A4" style={styles.page}>
        {/* El logo es un data URI (lib/marca.ts): tiene que viajar dentro del
            archivo, porque el PDF se manda como adjunto y una URL externa
            llegaría al cliente como un recuadro vacío. Sin logo cargado queda
            solo el nombre, que es el estado de hoy. */}
        <View style={styles.encabezado}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- es el Image de
              @react-pdf/renderer, no un <img>: no acepta alt */}
          {EMPRESA_LOGO !== "" && <Image src={EMPRESA_LOGO} style={styles.logoImg} />}
          <Text style={styles.logo}>{EMPRESA_NOMBRE.toUpperCase()}</Text>
        </View>

        <View style={styles.paginaBox} fixed>
          <Text
            style={styles.paginaLabel}
            render={({ pageNumber }) => `Página:      ${pageNumber}`}
          />
          <Text style={{ fontSize: 7, marginTop: 30 }}>{ec.clienteId}</Text>
        </View>

        {/* Destinatario */}
        <View style={styles.destinatario}>
          <View>
            <Text style={styles.srEs}>SR. (ES)</Text>
            <View style={styles.bloqueDir}>
              <Text style={styles.nombreDest}>{cliente.nombreCompleto.toUpperCase()}</Text>
              {cliente.direccion && (
                <Text style={styles.lineaDir}>{cliente.direccion.toUpperCase()}</Text>
              )}
              {domicilio !== "" && <Text style={styles.lineaDir}>{domicilio.toUpperCase()}</Text>}
            </View>
            <Text style={styles.docLinea}>
              D.N.I. {cliente.dni}  {cliente.nombreCompleto.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 24 }} />
        <View style={styles.rule} />

        {/* Leyenda institucional */}
        <View style={styles.leyenda}>
          {lineasLeyenda.map((l, i) => (
            <Text key={i} style={styles.leyendaTxt}>
              {l}
            </Text>
          ))}
        </View>

        <View style={styles.rule} />

        <View style={styles.barra}>
          <Text style={styles.barraTxt}>
            ESTADO DE CUENTAS UNIFICADO    CLIENTE Nº: {ec.clienteId}    AL{" "}
            {fechaCorta(ec.generadoEl)}    {comprobante(ec)}
          </Text>
        </View>

        <View style={styles.ruleFina} />

        {ec.planes.length === 0 ? (
          <Text style={{ marginTop: 12 }}>SIN PLANES DE PAGO REGISTRADOS.</Text>
        ) : (
          ec.planes.map((plan) => <PlanSection key={plan.planId} plan={plan} />)
        )}

        {/* Totales */}
        <View style={styles.totales}>
          <View style={styles.ruleFina} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL PAGADO</Text>
            <Text style={styles.totalValor}>{num(ec.totalPagado)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>SALDO PENDIENTE</Text>
            <Text style={styles.totalValor}>{num(ec.saldoPendiente)}</Text>
          </View>
          {ec.totalVencido > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, styles.vencido]}>TOTAL VENCIDO</Text>
              <Text style={[styles.totalValor, styles.vencido]}>{num(ec.totalVencido)}</Text>
            </View>
          )}
        </View>

        {/* Comportamiento de pago: la efectividad con la misma fórmula que se
            le aplica a los cobradores, los atrasos y las advertencias que tiene
            el cliente encima. */}
        <View style={styles.cumplimiento}>
          <Text style={styles.cumplimientoTitulo}>COMPORTAMIENTO DE PAGO</Text>

          <View style={styles.cumplimientoFila}>
            <Text style={styles.cumplimientoLabel}>Efectividad de pago</Text>
            <Text style={styles.cumplimientoValor}>{cumplimiento.efectividad}%</Text>
          </View>
          <View style={styles.cumplimientoFila}>
            <Text style={styles.cumplimientoLabel}>Cuotas pagadas</Text>
            <Text style={styles.cumplimientoValor}>
              {cumplimiento.cuotasPagadas} de {cumplimiento.cuotasTotales}
            </Text>
          </View>
          <View style={styles.cumplimientoFila}>
            <Text style={[styles.cumplimientoLabel, cumplimiento.cuotasAtrasadas > 0 ? styles.vencido : {}]}>
              Cuotas atrasadas
            </Text>
            <Text style={[styles.cumplimientoValor, cumplimiento.cuotasAtrasadas > 0 ? styles.vencido : {}]}>
              {cumplimiento.cuotasAtrasadas}
            </Text>
          </View>

          {cumplimiento.advertencias.length > 0 && (
            <>
              <Text style={[styles.cumplimientoTitulo, { marginTop: 6 }]}>
                ADVERTENCIAS ({cumplimiento.advertencias.length})
              </Text>
              {cumplimiento.advertencias.map((a, i) => (
                <View key={i} style={styles.advertenciaFila}>
                  <Text style={styles.advertenciaTexto}>
                    {formatFecha(a.fecha)}  {a.motivo}
                  </Text>
                  {a.recargo > 0 && (
                    <Text style={styles.advertenciaTexto}>recargo {num(a.recargo)}</Text>
                  )}
                </View>
              ))}
            </>
          )}
        </View>

        <Text style={styles.footer} fixed>
          Este documento es un detalle informativo de tu plan de pagos y no constituye comprobante
          fiscal.{"\n"}
          Emitido por {EMPRESA_NOMBRE} el {formatFecha(ec.generadoEl)}. Ante diferencias, consultá con tu
          cobrador asignado.
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Con qué se nombra el archivo: el DNI si lo hay, y si no el nombre.
 *
 * El DNI es opcional en la base y hay clientes sin él, así que usarlo solo
 * dejaba archivos "estado-cuenta--2026-08-10.pdf" — y dos clientes sin DNI
 * pisaban el mismo archivo en la carpeta de descargas.
 */
function identificador(cliente: EstadoCuentaPdfCliente): string {
  const dni = cliente.dni?.trim();
  if (dni) return dni;

  return (
    cliente.nombreCompleto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "cliente"
  );
}

/**
 * Genera el PDF como `File`.
 *
 * Un File y no un Blob porque `navigator.share()` solo acepta archivos: es la
 * única vía para que el PDF entre adjunto a un chat de WhatsApp desde el
 * navegador (un link wa.me no puede adjuntar nada).
 */
export async function archivoEstadoCuentaPdf(
  ec: EstadoDeCuenta,
  cliente: EstadoCuentaPdfCliente,
  leyenda?: string
): Promise<File> {
  const blob = await pdf(
    <EstadoCuentaDocument ec={ec} cliente={cliente} leyenda={leyenda} />
  ).toBlob();
  return new File([blob], `estado-cuenta-${identificador(cliente)}-${ec.generadoEl}.pdf`, {
    type: "application/pdf",
  });
}

/** Genera el PDF y dispara la descarga en el navegador */
export async function descargarEstadoCuentaPdf(
  ec: EstadoDeCuenta,
  cliente: EstadoCuentaPdfCliente,
  leyenda?: string
): Promise<void> {
  descargarArchivo(await archivoEstadoCuentaPdf(ec, cliente, leyenda));
}

/** Baja un archivo ya generado, sin volver a renderizar el PDF */
export function descargarArchivo(archivo: File): void {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.name;
  a.click();
  URL.revokeObjectURL(url);
}
