import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChartData } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { firstValueFrom } from 'rxjs';
import { DashboardApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';
import { ConexionService } from '../../core/conexion.service';
import { ESTADOS_ABIERTOS, ESTADO_INFO } from '../../core/estados';
import { Dashboard, METODOS_PAGO, ResumenPeriodo, formatoNumero } from '../../core/models';
import { ETAPAS, dataset, formatoBs, horas, opcionesBarras } from './graficas';

type Preset = '7' | '30' | 'mes' | 'mesAnterior' | 'anio' | 'custom';

interface Indicador {
  titulo: string;
  valor: string;
  /** Variación % frente al período anterior (null si no hay base). */
  delta: number | null;
  /** true si un aumento es bueno (ingresos), false si es malo (tiempo, reaperturas). */
  subirEsBueno: boolean;
  ayuda: string;
}

/** Fecha local en formato AAAA-MM-DD (hora del dispositivo, Bolivia). */
const fecha = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** HU-22 a HU-24: panel de indicadores clave (KPIs) para la toma de decisiones. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, BaseChartDirective, DecimalPipe, DatePipe],
  // Chart.js se registra aquí (y no en app.config) para que solo se descargue
  // al abrir Indicadores y no engorde la carga inicial de la PWA.
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(DashboardApi);
  readonly conexion = inject(ConexionService);

  readonly presets: { valor: Preset; texto: string }[] = [
    { valor: '7', texto: '7 días' },
    { valor: '30', texto: '30 días' },
    { valor: 'mes', texto: 'Este mes' },
    { valor: 'mesAnterior', texto: 'Mes anterior' },
    { valor: 'anio', texto: 'Este año' },
  ];
  readonly preset = signal<Preset>('30');
  desde = '';
  hasta = '';

  readonly datos = signal<Dashboard | null>(null);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  readonly bs = formatoBs;
  readonly horas = horas;
  readonly etapas = ETAPAS;
  readonly info = ESTADO_INFO;
  readonly abiertos = ESTADOS_ABIERTOS;
  readonly numero = formatoNumero;
  readonly metodoTexto: Record<string, string> = Object.fromEntries(
    METODOS_PAGO.map((m) => [m.valor, m.texto]),
  );

  // ---------------------------------------------------------------- KPIs

  readonly indicadores = computed<Indicador[]>(() => {
    const d = this.datos();
    if (!d) return [];
    const a = d.resumen;
    const b = d.anterior;
    const delta = (k: keyof ResumenPeriodo) =>
      variacion(a[k] as number | null, b[k] as number | null);
    return [
      {
        titulo: 'Ingresos cobrados',
        valor: formatoBs(a.ingresos),
        delta: delta('ingresos'),
        subirEsBueno: true,
        ayuda: `${a.cobros} cobro(s) en el período`,
      },
      {
        titulo: 'OT entregadas',
        valor: String(a.entregadas),
        delta: delta('entregadas'),
        subirEsBueno: true,
        ayuda: `${a.recibidas} recibidas · ${a.canceladas} canceladas`,
      },
      {
        titulo: 'Ticket promedio',
        valor: formatoBs(a.ticketPromedio),
        delta: delta('ticketPromedio'),
        subirEsBueno: true,
        ayuda: `Facturado: ${formatoBs(a.facturado)}`,
      },
      {
        titulo: 'Tiempo promedio de reparación',
        valor: a.horasReparacion == null ? '—' : horas(a.horasReparacion),
        delta: delta('horasReparacion'),
        subirEsBueno: false,
        ayuda: 'Desde el ingreso hasta "terminado"',
      },
      {
        titulo: 'Cumplimiento',
        valor: `${a.cumplimiento.toFixed(0)} %`,
        delta: delta('cumplimiento'),
        subirEsBueno: true,
        ayuda: 'OT recibidas en el período ya entregadas',
      },
      {
        titulo: 'Reaperturas (retrabajo)',
        valor: `${a.tasaReapertura.toFixed(0)} %`,
        delta: delta('tasaReapertura'),
        subirEsBueno: false,
        ayuda: 'Trabajos reabiertos tras darlos por terminados',
      },
      {
        titulo: 'Margen en repuestos',
        valor: formatoBs(a.margenRepuestos),
        delta: delta('margenRepuestos'),
        subirEsBueno: true,
        ayuda: `Venta de repuestos: ${formatoBs(a.repuestos)}`,
      },
      {
        titulo: 'Mano de obra facturada',
        valor: formatoBs(a.manoObra),
        delta: delta('manoObra'),
        subirEsBueno: true,
        ayuda: 'En OT entregadas en el período',
      },
    ];
  });

  // ---------------------------------------------------------------- gráficas

  readonly opcionesBs = opcionesBarras(formatoBs);
  readonly opcionesBsHorizontal = opcionesBarras(formatoBs, true);
  readonly opcionesHoras = opcionesBarras(horas, true);

  readonly graficaIngresos = computed<ChartData<'bar'>>(() => {
    const serie = this.datos()?.ingresosPorDia ?? [];
    return {
      labels: serie.map((x) => x.dia.slice(8, 10) + '/' + x.dia.slice(5, 7)),
      datasets: [dataset(serie.map((x) => x.monto), 'Ingresos')],
    };
  });

  readonly etapasOrdenadas = computed(() => {
    const lista = this.datos()?.tiempoPorEtapa ?? [];
    return Object.keys(ETAPAS)
      .map((k) => lista.find((e) => e.etapa === k))
      .filter((e): e is NonNullable<typeof e> => !!e);
  });

  readonly graficaEtapas = computed<ChartData<'bar'>>(() => {
    const etapas = this.etapasOrdenadas();
    return {
      labels: etapas.map((e) => ETAPAS[e.etapa]),
      datasets: [dataset(etapas.map((e) => e.horas ?? 0), 'Horas promedio')],
    };
  });

  readonly graficaRepuestos = computed<ChartData<'bar'>>(() => {
    const top = this.datos()?.topRepuestos ?? [];
    return {
      // Con código: dos repuestos pueden llamarse igual (distinta marca o medida).
      labels: top.map((r) => `${r.nombre} (${r.codigo})`),
      datasets: [dataset(top.map((r) => r.monto), 'Venta')],
    };
  });

  // ---------------------------------------------------------------- acciones

  ngOnInit() {
    this.aplicarPreset('30');
  }

  aplicarPreset(p: Preset) {
    this.preset.set(p);
    const hoy = new Date();
    let desde = new Date(hoy);
    let hasta = new Date(hoy);
    switch (p) {
      case '7':
        desde.setDate(hoy.getDate() - 6);
        break;
      case '30':
        desde.setDate(hoy.getDate() - 29);
        break;
      case 'mes':
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        break;
      case 'mesAnterior':
        desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        break;
      case 'anio':
        desde = new Date(hoy.getFullYear(), 0, 1);
        break;
      case 'custom':
        return;
    }
    this.desde = fecha(desde);
    this.hasta = fecha(hasta);
    this.cargar();
  }

  /** HU-24: rango de fechas libre. */
  rangoPersonalizado() {
    this.preset.set('custom');
    if (this.desde && this.hasta) this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.datos.set(await firstValueFrom(this.api.kpis(this.desde, this.hasta)));
    } catch (err) {
      this.error.set(mensajeError(err));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Verde si el indicador mejora, rojo si empeora (con flecha y signo, no solo color). */
  claseDelta(i: Indicador) {
    if (i.delta == null || Math.abs(i.delta) < 0.5) return 'neutro';
    return i.delta > 0 === i.subirEsBueno ? 'mejora' : 'empeora';
  }
}

function variacion(actual: number | null, anterior: number | null): number | null {
  if (actual == null || anterior == null || anterior === 0) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}
