<#
  Servicio local de impresion de tickets para la impresora termica.

  El punto de venta (navegador) manda el ticket a http://localhost:17777/imprimir y este servicio
  lo envia directo a la impresora en ESC/POS (modo RAW del spooler de Windows). Asi no se usa el
  cuadro de impresion del navegador ni el tamano de papel del driver (Carta): la impresora avanza
  solo lo que mide el ticket y lo corta al final.

  Uso:
    powershell -ExecutionPolicy Bypass -File impresora.ps1 -Impresora "Nombre de la impresora"
    powershell -ExecutionPolicy Bypass -File impresora.ps1 -Prueba      (imprime un ticket de prueba)
#>
param(
  # Nombre de la impresora tal como aparece en Windows. Vacio = impresora predeterminada.
  [string]$Impresora = '',
  [int]$Puerto = 17777,
  # Caracteres por renglon: 48 para rollo de 80 mm, 32 para rollo de 58 mm.
  [int]$Columnas = 48,
  # Paginas que pueden mandar a imprimir, separadas por coma.
  [string]$Origenes = 'https://punto-de-venta-juan-mejia-front.vercel.app,http://localhost:3000',
  # Para pruebas: guarda los bytes en este archivo en lugar de mandarlos a la impresora.
  [string]$Archivo = '',
  # Imprime un ticket de prueba y termina.
  [switch]$Prueba
)

$ErrorActionPreference = 'Stop'

if (-not $Impresora -and -not $Archivo) {
  $Impresora = (Get-CimInstance Win32_Printer -Filter 'Default=TRUE').Name
  if (-not $Impresora) { throw 'No hay impresora predeterminada; indica una con -Impresora "Nombre"' }
}
$permitidos = @($Origenes.Split(',') | ForEach-Object { $_.Trim().TrimEnd('/') } | Where-Object { $_ })

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class ImpresoraRaw {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOC_INFO_1 { public string pDocName; public string pOutputFile; public string pDatatype; }

  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool OpenPrinter(string nombre, out IntPtr h, IntPtr predeterminado);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern int StartDocPrinter(IntPtr h, int nivel, [In] DOC_INFO_1 info);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool WritePrinter(IntPtr h, byte[] datos, int largo, out int escritos);

  public static void Enviar(string impresora, byte[] datos) {
    IntPtr h;
    if (!OpenPrinter(impresora, out h, IntPtr.Zero)) throw new Win32Exception(Marshal.GetLastWin32Error(), "No se pudo abrir la impresora \"" + impresora + "\"");
    try {
      var info = new DOC_INFO_1 { pDocName = "Ticket", pDatatype = "RAW" };
      if (StartDocPrinter(h, 1, info) == 0) throw new Win32Exception(Marshal.GetLastWin32Error());
      try {
        StartPagePrinter(h);
        int escritos;
        if (!WritePrinter(h, datos, datos.Length, out escritos)) throw new Win32Exception(Marshal.GetLastWin32Error());
        EndPagePrinter(h);
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
'@

# Pagina de codigos 850 (multilingue latino): acentos, enie, signos de apertura.
$cp850 = [System.Text.Encoding]::GetEncoding(850)

function Cmd($b, [int[]]$bytes) { foreach ($x in $bytes) { $b.Add([byte]$x) } }
function Linea($b, [string]$s) { $b.AddRange($cp850.GetBytes($s)); $b.Add(10) }
function Negrita($b, [bool]$si) { Cmd $b 0x1B, 0x45, ([int]$si) }

function Ajustar([string]$s, [int]$ancho) {
  $lineas = New-Object System.Collections.Generic.List[string]
  foreach ($parrafo in ($s -split "`r?`n")) {
    $actual = ''
    foreach ($p in ($parrafo -split ' ')) {
      while ($p.Length -gt $ancho) {
        if ($actual) { $lineas.Add($actual); $actual = '' }
        $lineas.Add($p.Substring(0, $ancho)); $p = $p.Substring($ancho)
      }
      if (-not $actual) { $actual = $p }
      elseif ($actual.Length + 1 + $p.Length -le $ancho) { $actual += ' ' + $p }
      else { $lineas.Add($actual); $actual = $p }
    }
    $lineas.Add($actual)
  }
  , $lineas.ToArray()
}

function DosColumnas([string]$izq, [string]$der, [int]$ancho) {
  if (-not $der) { return , (Ajustar $izq $ancho) }
  if ($izq.Length + 1 + $der.Length -le $ancho) { return , @($izq + (' ' * ($ancho - $izq.Length - $der.Length)) + $der) }
  , (@(Ajustar $izq $ancho) + @($der.PadLeft($ancho)))
}

function Construir($t) {
  $b = New-Object System.Collections.Generic.List[byte]
  Cmd $b 0x1B, 0x40          # inicializar
  Cmd $b 0x1B, 0x74, 2       # pagina de codigos CP850

  Cmd $b 0x1B, 0x61, 1       # centrado
  $enc = @($t.encabezado | Where-Object { $_ })
  if ($enc.Count -gt 0) {
    Cmd $b 0x1D, 0x21, 0x11  # doble alto y ancho
    Negrita $b $true
    foreach ($l in (Ajustar $enc[0] ([int][math]::Floor($Columnas / 2)))) { Linea $b $l }
    Cmd $b 0x1D, 0x21, 0x00
    Negrita $b $false
    for ($i = 1; $i -lt $enc.Count; $i++) { foreach ($l in (Ajustar $enc[$i] $Columnas)) { Linea $b $l } }
  }
  Cmd $b 0x1B, 0x61, 0       # izquierda
  Linea $b ('-' * $Columnas)

  foreach ($d in @($t.datos | Where-Object { $_ })) { foreach ($l in (Ajustar $d $Columnas)) { Linea $b $l } }

  if ($t.titulo) { Negrita $b $true; Linea $b $t.titulo; Negrita $b $false }
  foreach ($it in @($t.items | Where-Object { $_ })) {
    Negrita $b $true
    foreach ($l in (Ajustar $it.nombre $Columnas)) { Linea $b $l }
    Negrita $b $false
    foreach ($l in (Ajustar $it.detalle $Columnas)) { Linea $b $l }
  }

  Linea $b ('=' * $Columnas)
  foreach ($tot in @($t.totales | Where-Object { $_ })) {
    Negrita $b ([bool]$tot.resaltar)
    foreach ($l in (DosColumnas $tot.etiqueta $tot.valor $Columnas)) { Linea $b $l }
    Negrita $b $false
  }

  $avisos = @($t.avisos | Where-Object { $_ })
  if ($avisos.Count -gt 0) {
    Linea $b ('-' * $Columnas)
    Negrita $b $true
    foreach ($a in $avisos) { foreach ($l in (Ajustar $a $Columnas)) { Linea $b $l } }
    Negrita $b $false
  }

  Linea $b ('-' * $Columnas)
  Cmd $b 0x1B, 0x61, 1
  foreach ($p in @($t.pie | Where-Object { $_ })) { foreach ($l in (Ajustar $p $Columnas)) { Linea $b $l } }
  Cmd $b 0x1B, 0x61, 0

  Cmd $b 0x1D, 0x56, 66, 0   # avanzar hasta la cuchilla y cortar
  , $b.ToArray()
}

function Enviar([byte[]]$datos) {
  if ($Archivo) { [System.IO.File]::WriteAllBytes($Archivo, $datos) }
  else { [ImpresoraRaw]::Enviar($Impresora, $datos) }
}

if ($Prueba) {
  $c = { param([int[]]$codigos) -join ($codigos | ForEach-Object { [char]$_ }) }
  $ticket = [pscustomobject]@{
    encabezado = @('Punto de Venta', "Juan Mej$(& $c 0xED)a", 'Ticket de prueba')
    titulo     = 'PRODUCTOS:'
    items      = @([pscustomobject]@{ nombre = 'Producto de prueba con un nombre bastante largo para ver el ajuste'; detalle = 'Cantidad: 2 x $50.00 = $100.00' })
    totales    = @(
      [pscustomobject]@{ etiqueta = 'TOTAL:'; valor = '$100.00'; resaltar = $true },
      [pscustomobject]@{ etiqueta = 'Pagado:'; valor = '$200.00' },
      [pscustomobject]@{ etiqueta = 'Cambio:'; valor = '$100.00' }
    )
    pie        = @("$(& $c 0xA1)Impresora configurada!", "Acentos: $(& $c 0xE1,0xE9,0xED,0xF3,0xFA) $(& $c 0xF1) $(& $c 0xC1,0xC9,0xCD,0xD3,0xDA) $(& $c 0xD1)")
  }
  Enviar (Construir $ticket)
  Write-Host "Ticket de prueba enviado a: $(if ($Archivo) { $Archivo } else { $Impresora })"
  return
}

function Responder($res, [int]$codigo, $obj) {
  $res.StatusCode = $codigo
  if ($null -ne $obj) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress))
    $res.ContentType = 'application/json; charset=utf-8'
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  }
  $res.Close()
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Puerto/")
$listener.Prefixes.Add("http://127.0.0.1:$Puerto/")
$listener.Start()
Write-Host "Servicio de impresion escuchando en http://localhost:$Puerto (impresora: $(if ($Archivo) { $Archivo } else { $Impresora }))"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $origen = $req.Headers['Origin']
    if ($origen -and ($permitidos -notcontains $origen.TrimEnd('/'))) {
      Responder $res 403 @{ ok = $false; error = "Origen no permitido: $origen" }
      continue
    }
    if ($origen) { $res.AddHeader('Access-Control-Allow-Origin', $origen); $res.AddHeader('Vary', 'Origin') }
    $res.AddHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    $res.AddHeader('Access-Control-Allow-Headers', 'Content-Type')
    $res.AddHeader('Access-Control-Allow-Private-Network', 'true')

    $ruta = $req.Url.AbsolutePath.TrimEnd('/')
    if ($req.HttpMethod -eq 'OPTIONS') {
      Responder $res 204 $null
    }
    elseif ($req.HttpMethod -eq 'GET' -and $ruta -eq '/estado') {
      Responder $res 200 @{ ok = $true; impresora = $(if ($Archivo) { $Archivo } else { $Impresora }); columnas = $Columnas }
    }
    elseif ($req.HttpMethod -eq 'POST' -and $ruta -eq '/imprimir') {
      if ($req.ContentLength64 -gt 1MB) { Responder $res 413 @{ ok = $false; error = 'Ticket demasiado grande' }; continue }
      $lector = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
      $ticket = $lector.ReadToEnd() | ConvertFrom-Json
      Enviar (Construir $ticket)
      Responder $res 200 @{ ok = $true }
    }
    else {
      Responder $res 404 @{ ok = $false; error = 'Ruta no encontrada' }
    }
  }
  catch {
    Write-Warning $_.Exception.Message
    try { Responder $res 500 @{ ok = $false; error = $_.Exception.Message } } catch {}
  }
}
