import { Component, computed, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { inject } from '@angular/core';

/** Íconos de línea (trazo 2px, color del texto) usados en el menú. */
const ICONOS: Record<string, string> = {
  inicio: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
  ordenes:
    '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h4"/>',
  vehiculos:
    '<path d="M3 16v-4l2-5h14l2 5v4"/><path d="M3 16h18v2H3z"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="16.5" cy="18.5" r="1.5"/><path d="M5 12h14"/>',
  inventario:
    '<path d="M12 3 3 7.5v9L12 21l9-4.5v-9z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  indicadores: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
  clientes: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  configuracion:
    '<path d="M12 2.5 20.2 7.25v9.5L12 21.5l-8.2-4.75v-9.5z"/><circle cx="12" cy="12" r="3.5"/>',
  personal:
    '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  sincronizacion:
    '<path d="M20 12a8 8 0 0 1-14 5.3"/><path d="M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
  panel: '<path d="M4 19l5-6 4 3 7-9"/><path d="M15 7h5v5"/>',
  talleres:
    '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8"/><path d="M10 21v-5h4v5"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  agregar: '<path d="M12 5v14M5 12h14"/>',
  comprobante: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  imprimir: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  alerta: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.01"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  campana: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  mas:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  editar: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  quitar: '<path d="M18 6 6 18M6 6l12 12"/>',
  taller: '<path d="M3 21V9l9-6 9 6v12"/><path d="M7 21v-8h10v8M7 17h10"/>',
  recibir: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v3h16v-3"/>',
  diagnostico: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  llave: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-2-2 6.4-6.4a4 4 0 0 1-5-5L9 4.2 7.6 5.6 4 2 2 4l3.6 3.6L4.2 9l3.1 3.1"/>',
  entregado: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  carpeta: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
};

@Component({
  selector: 'app-icono',
  standalone: true,
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" [innerHTML]="svg()"></svg>`,
  styles: `:host { display: inline-flex; } svg { width: 1em; height: 1em; vertical-align: -0.125em; }`,
})
export class IconoComponent {
  readonly nombre = input.required<string>();
  private readonly san = inject(DomSanitizer);
  readonly svg = computed(() => this.san.bypassSecurityTrustHtml(ICONOS[this.nombre()] ?? ''));
}
