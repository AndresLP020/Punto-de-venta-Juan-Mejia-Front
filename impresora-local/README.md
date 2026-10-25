# Servicio de impresión de tickets

Programa pequeño que corre en la computadora de la caja. El punto de venta le manda cada ticket
y él lo envía **directo a la impresora térmica** (ESC/POS), sin el cuadro de impresión del
navegador y sin el tamaño de papel de Windows (Carta). La impresora avanza solo lo que mide el
ticket y lo corta al final.

Si el servicio no está corriendo, el punto de venta usa la impresión del navegador como respaldo.

No hay que instalar nada: usa PowerShell, que ya viene en Windows.

## Instalación en la computadora de la caja

1. Copia esta carpeta `impresora-local` a la computadora, por ejemplo en `C:\impresora-local`.
2. Abre `configuracion.bat` con el Bloc de notas y escribe el nombre de la impresora de tickets
   tal como aparece en **Configuración → Impresoras y escáneres**:
   ```
   set IMPRESORA=POS-80
   ```
   Si la dejas vacía se usa la impresora predeterminada de Windows.
3. Haz doble clic en `probar-impresora.bat`. Debe salir un ticket de prueba cortado a su medida.
   Si falla, la ventana muestra el error y la lista de impresoras instaladas, para copiar el
   nombre exacto.
4. Para que arranque solo al prender la computadora: presiona **Windows + R**, escribe
   `shell:startup` y pega ahí un **acceso directo** a `iniciar-impresora.bat`.
5. Haz doble clic en `iniciar-impresora.bat` (o reinicia) y entra al punto de venta.

La primera vez que cobres, Chrome puede preguntar si el sitio puede **acceder a dispositivos de
tu red local**: elige **Permitir**. Es la conexión del punto de venta con este servicio.

## Comprobar que está corriendo

Abre en el navegador de la caja: <http://localhost:17777/estado>. Debe mostrar el nombre de la
impresora.

## Notas

- Rollo de 58 mm: en `configuracion.bat` cambia `COLUMNAS=48` por `COLUMNAS=32`.
- Solo acepta tickets del punto de venta publicado y de `http://localhost:3000` (desarrollo).
  Si cambia la dirección del front, actualiza `-Origenes` en `impresora.ps1`.
- La impresora debe entender ESC/POS (casi todas las térmicas de 58/80 mm lo hacen).
