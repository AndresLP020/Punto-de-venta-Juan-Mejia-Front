/**
 * Datos comerciales de ARISE Athletic Shop.
 *
 * Deja un campo vacío ('') para ocultarlo en la página: así no se publica
 * información que todavía no esté confirmada. Completa los valores reales
 * cuando estén disponibles.
 */
export const TIENDA = {
  nombre: 'ARISE Athletic Shop',
  lema: 'Tu estilo. Tu fuerza. Tu evolución.',
  /** Número de WhatsApp con lada internacional, sin "+" ni espacios. Ej. 5215512345678 */
  whatsapp: '',
  /** Teléfono como se mostrará al público. Ej. +52 55 1234 5678 */
  telefono: '',
  email: '',
  direccion: '',
  /** Una línea por horario. Ej. ['Lunes a sábado: 10:00 am - 8:00 pm'] */
  horarios: [] as string[],
  redes: {
    instagram: '',
    facebook: '',
    tiktok: '',
  },
};

export const LOGO_SRC = '/arise-logo.png';
